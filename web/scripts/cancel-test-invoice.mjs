import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const BASE = "https://api-m.sandbox.paypal.com";
const ID = "INV2-VED2-UYDQ-JZH9-Y7GS";

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !secret) {
  console.error("Missing sandbox credentials.");
  process.exit(1);
}

async function main() {
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

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  async function getInvoice() {
    const response = await fetch(
      `${BASE}/v2/invoicing/invoices/${ID}`,
      { headers, cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`GET HTTP ${response.status}`);
    }

    return response.json();
  }

  function checkIdentity(invoice) {
    if (
      invoice.id !== ID ||
      invoice.detail?.reference !== "AC-714" ||
      invoice.amount?.currency_code !== "USD" ||
      Number(invoice.amount?.value) !== 900
    ) {
      throw new Error("Identity mismatch. Action blocked.");
    }
  }

  const before = await getInvoice();
  checkIdentity(before);

  console.log("Invoice ID:", before.id);
  console.log("Reference:", before.detail.reference);
  console.log("Amount: USD", before.amount.value);
  console.log("Current status:", before.status);

  if (before.status === "CANCELLED") {
    console.log("CANCELLATION VERIFICATION: PASS");
    console.log("Already cancelled. No action taken.");
    return;
  }

  const eligible = ["UNPAID", "SENT"].includes(before.status);

  if (!eligible) {
    console.log("CANCELLATION BLOCKED: ineligible state");
    return;
  }

  if (!process.argv.includes("--execute")) {
    console.log("PREFLIGHT: PASS");
    console.log("READ-ONLY MODE: No action performed.");
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    `Type CANCEL ${ID} to confirm sandbox cancellation: `
  );
  rl.close();

  if (answer.trim() !== `CANCEL ${ID}`) {
    console.log("Approval denied. No action.");
    return;
  }

  // Recheck immediately before changing PayPal state.
  const fresh = await getInvoice();
  checkIdentity(fresh);

  if (!["UNPAID", "SENT"].includes(fresh.status)) {
    console.log("State changed. Cancellation blocked.");
    return;
  }

  const result = await fetch(
    `${BASE}/v2/invoicing/invoices/${ID}/cancel`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        send_to_recipient: false,
        send_to_invoicer: false
      })
    }
  );

  console.log("Cancel HTTP:", result.status);

  if (result.status !== 204) {
    const error = await result.json().catch(() => ({}));
    console.log("Error:", error.name || "Unknown");
    console.log(
      "Issues:",
      (error.details || []).map(d => d.issue)
    );
    console.log("No automatic retry.");
  }

  const after = await getInvoice();
  checkIdentity(after);

  console.log("After status:", after.status);

  if (after.status === "CANCELLED") {
    console.log("CANCELLATION VERIFICATION: PASS");
  } else {
    console.log("CANCELLATION VERIFICATION: CHECK REQUIRED");
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
