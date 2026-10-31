const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing PayPal sandbox credentials.");
  process.exit(1);
}

const baseUrl = "https://api-m.sandbox.paypal.com";

try {
  const basicAuth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const auth = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!auth.ok) {
    console.error(`OAuth: FAILED (HTTP ${auth.status})`);
    process.exit(1);
  }

  const authData = await auth.json();

  if (!authData.access_token) {
    throw new Error("No access token received.");
  }

  console.log("OAuth: SUCCESS");

  const invoices = await fetch(
    `${baseUrl}/v2/invoicing/invoices?page=1&page_size=2`,
    {
      headers: {
        Authorization: `Bearer ${authData.access_token}`,
        Accept: "application/json"
      }
    }
  );

  console.log(`Invoice list HTTP: ${invoices.status}`);

  if (invoices.ok) {
    const data = await invoices.json();
    console.log(
      `Invoices returned: ${data.items?.length ?? 0}`
    );
  } else {
    console.log("Invoice access needs investigation.");
  }
} catch (error) {
  console.error("Test error:", error.message);
  process.exitCode = 1;
}
