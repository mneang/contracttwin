const BASE = "https://api-m.sandbox.paypal.com";
const ID = "INV2-VED2-UYDQ-JZH9-Y7GS";

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !secret) {
  console.error("Missing PayPal sandbox credentials.");
  process.exit(1);
}

async function run() {
  const basic = Buffer.from(
    `${clientId}:${secret}`
  ).toString("base64");

  const authResponse = await fetch(
    `${BASE}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  if (!authResponse.ok) {
    throw new Error(`OAuth HTTP ${authResponse.status}`);
  }

  const { access_token: token } = await authResponse.json();

  if (!token) throw new Error("Missing access token.");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  async function getInvoice() {
    const response = await fetch(
      `${BASE}/v2/invoicing/invoices/${ID}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Invoice GET HTTP ${response.status}`);
    }

    return response.json();
  }

  // Verify the exact invoice before modifying it.
  const before = await getInvoice();

  console.log("Before status:", before.status);

  if (
    before.id !== ID ||
    before.detail?.reference !== "AC-714" ||
    before.amount?.currency_code !== "USD" ||
    Number(before.amount?.value) !== 900
  ) {
    throw new Error("Invoice identity mismatch. No action.");
  }

  if (before.status !== "DRAFT") {
    console.log("Not a draft. No send request performed.");
    return;
  }

  // Issue without emailing recipient or merchant.
  const response = await fetch(
    `${BASE}/v2/invoicing/invoices/${ID}/send`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        send_to_recipient: false,
        send_to_invoicer: false
      })
    }
  );

  console.log("Send HTTP:", response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.log("Error:", error.name || "Unknown");
    console.log(
      "Issues:",
      (error.details || []).map(d => d.issue)
    );
  }

  // Read authoritative state even if POST failed.
  const after = await getInvoice();

  console.log("After status:", after.status);

  const payable = ["UNPAID", "SENT"].includes(
    after.status
  );

  if (
    payable &&
    after.id === ID &&
    after.detail?.reference === "AC-714" &&
    Number(after.amount?.value) === 900
  ) {
    console.log("ISSUE VERIFICATION: PASS");
  } else {
    console.log("ISSUE VERIFICATION: CHECK REQUIRED");
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
