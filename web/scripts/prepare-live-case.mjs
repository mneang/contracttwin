const BASE = "https://api-m.sandbox.paypal.com";
const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;

if (!id || !secret) {
  throw new Error("Missing sandbox credentials");
}

const auth = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: "grant_type=client_credentials"
});

if (!auth.ok) {
  throw new Error(`OAuth failed: HTTP ${auth.status}`);
}

const { access_token: token } = await auth.json();
if (!token) throw new Error("No access token");

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
};

async function getInvoice(invoiceId) {
  const r = await fetch(
    `${BASE}/v2/invoicing/invoices/${invoiceId}`,
    { headers, cache: "no-store" }
  );
  if (!r.ok) throw new Error(`GET HTTP ${r.status}`);
  return r.json();
}

// Entirely fictional business data.
const record = {
  detail: {
    invoice_number:
      `CT-LIVE-${Date.now().toString(36).toUpperCase()}`,
    reference: "AC-714",
    currency_code: "USD",
    memo: "ContractTwin CASE-001 — sandbox test",
    payment_term: { term_type: "DUE_ON_RECEIPT" }
  },
  invoicer: {
    name: {
      given_name: "ContractTwin",
      surname: "Sandbox"
    }
  },
  primary_recipients: [{
    billing_info: {
      email_address: "sandbox-buyer@example.com"
    }
  }],
  items: [{
    name: "October equipment rental",
    description:
      "Source Agreement A; October 2026 equipment rental; test only",
    quantity: "1",
    unit_amount: {
      currency_code: "USD",
      value: "900.00"
    }
  }]
};

const create = await fetch(
  `${BASE}/v2/invoicing/invoices`,
  {
    method: "POST",
    headers,
    body: JSON.stringify(record)
  }
);

const result = await create.json().catch(() => ({}));
console.log("Create HTTP:", create.status);

if (!create.ok) {
  console.log(
    "Issues:",
    (result.details || []).map(x => x.issue)
  );
  process.exit(1);
}

const selfLink =
  result.links?.find(x => x.rel === "self")?.href ||
  create.headers.get("location") ||
  "";

const invoiceId =
  result.id ||
  selfLink.match(/INV2-[A-Za-z0-9-]+/)?.[0];

if (!invoiceId) {
  throw new Error(
    "Invoice created but ID missing. Check invoice list before rerunning."
  );
}

console.log("NEW INVOICE ID:", invoiceId);

// Verify before issuing.
const draft = await getInvoice(invoiceId);

const validDraft =
  draft.status === "DRAFT" &&
  draft.detail?.reference === "AC-714" &&
  draft.amount?.currency_code === "USD" &&
  Number(draft.amount?.value) === 900 &&
  draft.items?.some(
    x =>
      x.name === "October equipment rental" &&
      x.description?.includes("Source Agreement A")
  );

if (!validDraft) {
  throw new Error("Draft verification failed. Not issuing.");
}

// Issue without PayPal email notifications.
const issue = await fetch(
  `${BASE}/v2/invoicing/invoices/${invoiceId}/send`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({
      send_to_recipient: false,
      send_to_invoicer: false
    })
  }
);

console.log("Issue HTTP:", issue.status);

if (!issue.ok) {
  const error = await issue.json().catch(() => ({}));
  console.log(
    "Issues:",
    (error.details || []).map(x => x.issue)
  );
}

// Verify the authoritative PayPal state.
const actual = await getInvoice(invoiceId);

console.log("GET status:", actual.status);

const passed =
  ["UNPAID", "SENT"].includes(actual.status) &&
  actual.id === invoiceId &&
  actual.detail?.reference === "AC-714" &&
  Number(actual.amount?.value) === 900;

console.log(
  "LIVE CASE PREPARATION:",
  passed ? "PASS" : "CHECK REQUIRED"
);

if (!passed) process.exitCode = 1;
