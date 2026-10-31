const BASE = "https://api-m.sandbox.paypal.com";

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !secret) {
  console.error("Missing PayPal sandbox credentials.");
  process.exit(1);
}

async function run() {
  // 1. Authenticate with PayPal Sandbox
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

  const auth = await authResponse.json();
  const token = auth.access_token;

  if (!token) {
    throw new Error("No access token returned.");
  }

  console.log("OAuth: SUCCESS");

  // 2. Build our fictional old-contract invoice
  const invoice = {
    detail: {
      invoice_number:
        `CT-${Date.now().toString(36).toUpperCase()}`,
      reference: "AC-714",
      currency_code: "USD",
      memo: "ContractTwin sandbox test only",
      payment_term: {
        term_type: "DUE_ON_RECEIPT"
      }
    },
    invoicer: {
      name: {
        given_name: "ContractTwin",
        surname: "Sandbox"
      }
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: "sandbox-buyer@example.com"
        }
      }
    ],
    items: [
      {
        name: "October equipment rental",
        description: "Fictional expired agreement",
        quantity: "1",
        unit_amount: {
          currency_code: "USD",
          value: "900.00"
        }
      }
    ]
  };

  // 3. Create a DRAFT — do not send
  const createResponse = await fetch(
    `${BASE}/v2/invoicing/invoices`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(invoice)
    }
  );

  const created = await createResponse.json()
    .catch(() => ({}));

  console.log(
    `Create invoice HTTP: ${createResponse.status}`
  );

  if (!createResponse.ok) {
    console.error("PayPal error:", created.name);
    console.error(
      "Issues:",
      (created.details || []).map(d => d.issue)
    );
    return;
  }

  // 4. Extract the real PayPal invoice ID
  const selfLink = created.links?.find(
    link => link.rel === "self"
  )?.href || createResponse.headers.get("location") || "";

  const invoiceId =
    created.id ||
    selfLink.match(/\/invoices\/(INV2-[A-Za-z0-9-]+)/)?.[1];

  if (!invoiceId) {
    console.error(
      "Invoice may have been created, but no ID was found."
    );
    console.error("Check the invoice list before rerunning.");
    return;
  }

  console.log("Invoice ID:", invoiceId);

  // 5. Independently GET the invoice
  const getResponse = await fetch(
    `${BASE}/v2/invoicing/invoices/${invoiceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  console.log(
    `GET invoice HTTP: ${getResponse.status}`
  );

  if (!getResponse.ok) {
    console.error("GET failed. Do not create another draft yet.");
    return;
  }

  const verified = await getResponse.json();

  console.log("Status:", verified.status);
  console.log("Reference:", verified.detail?.reference);
  console.log(
    "Amount:",
    verified.amount?.currency_code,
    verified.amount?.value
  );

  const passed =
    verified.id === invoiceId &&
    verified.status === "DRAFT" &&
    verified.detail?.reference === "AC-714" &&
    verified.amount?.currency_code === "USD" &&
    Number(verified.amount?.value) === 900;

  console.log(
    passed
      ? "DRAFT VERIFICATION: PASS"
      : "DRAFT VERIFICATION: CHECK REQUIRED"
  );
}

run().catch(error => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
