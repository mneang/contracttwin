import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const BASE = 'https://api-m.sandbox.paypal.com';
const JOURNAL = 'recovery-state/CASE-001.json';
const mode = process.argv[2] || '--check';
const OLD_ID = process.env.CONTRACTTWIN_TEST_INVOICE_ID;

if (!['--check', '--execute', '--status'].includes(mode)) {
  throw Error('Use --check, --execute, or --status');
}

if (!process.env.PAYPAL_CLIENT_ID ||
    !process.env.PAYPAL_CLIENT_SECRET) {
  throw Error('Missing PayPal sandbox credentials');
}

const recorded = JSON.parse(await readFile(JOURNAL, 'utf8'));
const newId = recorded.newId;

if (
  !/^INV2-[A-Za-z0-9-]+$/.test(OLD_ID || '') ||
  !/^INV2-[A-Za-z0-9-]+$/.test(newId || '') ||
  recorded.oldId !== OLD_ID ||
  newId === OLD_ID
) {
  throw Error('Recovery journal invoice identity mismatch. STOP.');
}

const basic = Buffer.from(
  `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
).toString('base64');

const auth = await fetch(`${BASE}/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${basic}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials',
  signal: AbortSignal.timeout(20000)
});

if (!auth.ok) throw Error(`OAuth HTTP ${auth.status}`);

const { access_token: token } = await auth.json();
if (!token) throw Error('Missing OAuth access token');

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
};

async function getInvoice(id) {
  const response = await fetch(
    `${BASE}/v2/invoicing/invoices/${id}`,
    {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000)
    }
  );

  if (!response.ok) {
    throw Error(`Invoice ${id} GET HTTP ${response.status}`);
  }

  return response.json();
}

async function getBoth() {
  const original = await getInvoice(OLD_ID);
  const replacement = await getInvoice(newId);
  return { original, replacement };
}

const buyer = 'sandbox-buyer@example.com';

const sameBuyer = invoice =>
  invoice.primary_recipients?.[0]
    ?.billing_info?.email_address === buyer;

function identityOK(original, replacement) {
  return (
    original.id === OLD_ID &&
    replacement.id === newId &&
    original.detail?.reference === 'AC-714' &&
    replacement.detail?.reference === 'AC-714' &&
    original.amount?.currency_code === 'USD' &&
    replacement.amount?.currency_code === 'USD' &&
    Number(original.amount?.value) === 900 &&
    Number(replacement.amount?.value) === 1200 &&
    sameBuyer(original) &&
    sameBuyer(replacement) &&
    original.detail?.memo?.includes('CASE-001') &&
    replacement.detail?.memo?.includes(OLD_ID) &&
    original.items?.length === 1 &&
    replacement.items?.length === 1 &&
    original.items[0]?.name === 'October equipment rental' &&
    replacement.items[0]?.name === 'October equipment rental' &&
    original.items[0]?.description
      ?.includes('Source Agreement A') &&
    original.items[0]?.description
      ?.includes('October 2026') &&
    replacement.items[0]?.description
      ?.includes('Source Agreement B') &&
    replacement.items[0]?.description
      ?.includes(`replaces ${OLD_ID}`) &&
    (
      original.due_amount?.value == null ||
      Number(original.due_amount.value) === 900
    )
  );
}

async function updateJournal(phase, extra = {}) {
  recorded.phase = phase;
  recorded.updatedAt = new Date().toISOString();
  Object.assign(recorded, extra);

  await writeFile(
    JOURNAL,
    JSON.stringify(recorded, null, 2),
    { mode: 0o600 }
  );
}

function show(original, replacement) {
  console.log('Journal phase:', recorded.phase);

  console.log(
    'Original invoice:', original.id,
    '|', original.status,
    '| USD', original.amount?.value
  );

  console.log(
    'Replacement:', replacement.id,
    '|', replacement.status,
    '| USD', replacement.amount?.value
  );
}

function expectedPlan() {
  return (
    recorded.approvedDecision === 'REPLACE' &&
    recorded.governingAgreement === 'B' &&
    recorded.amountOld === 900 &&
    recorded.amountNew === 1200 &&
    ['A-END', 'B-START', 'B-RATE'].every(
      id => recorded.citedClauses?.includes(id)
    )
  );
}

// First, read both authoritative PayPal records.
const first = await getBoth();
show(first.original, first.replacement);

if (!identityOK(first.original, first.replacement)) {
  throw Error(
    'Invoice amount, buyer, source, or reference mismatch. STOP.'
  );
}

// Status mode never mutates PayPal.
if (mode === '--status') {
  console.log('STATUS CHECK: COMPLETE. NO PAYPAL MUTATIONS.');
  process.exit(0);
}

if (
  recorded.phase !== 'DRAFT_VERIFIED' ||
  !expectedPlan()
) {
  throw Error(
    'Journal not draft-ready. STOP. Use --status.'
  );
}

if (
  first.original.status !== 'UNPAID' ||
  first.replacement.status !== 'DRAFT'
) {
  throw Error(
    'Original not UNPAID or replacement not DRAFT. STOP.'
  );
}

console.log('RECOVERY PREFLIGHT: PASS');

if (mode === '--check') {
  console.log('READ-ONLY: NO PAYPAL MUTATIONS');
  process.exit(0);
}

// One exact approval binds BOTH invoice IDs.
const phrase = `APPROVE ${OLD_ID} ${newId}`;

const rl = createInterface({
  input: stdin,
  output: stdout
});

let answer;

try {
  answer = await rl.question(
    `Type ${phrase} to execute sandbox recovery: `
  );
} finally {
  rl.close();
}

if (answer.trim() !== phrase) {
  console.log('APPROVAL DENIED. NO PAYPAL MUTATIONS.');
  process.exit(0);
}

// Recheck AFTER human approval.
const fresh = await getBoth();

if (
  !identityOK(fresh.original, fresh.replacement) ||
  fresh.original.status !== 'UNPAID' ||
  fresh.replacement.status !== 'DRAFT'
) {
  throw Error('State changed after approval. STOP.');
}

// Write journal BEFORE every mutation.
// Never automatically retry financial operations.
await updateJournal('CANCEL_ATTEMPTED');

const cancelled = await fetch(
  `${BASE}/v2/invoicing/invoices/${OLD_ID}/cancel`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      send_to_recipient: false,
      send_to_invoicer: false
    }),
    signal: AbortSignal.timeout(20000)
  }
);

console.log('CANCEL HTTP:', cancelled.status);

if (cancelled.status !== 204) {
  console.log(
    'Cancellation unconfirmed. Run --status.'
  );
  throw Error('Cancellation not confirmed. No retry.');
}

// Independently verify cancellation.
const afterCancel = await getBoth();

if (
  !identityOK(
    afterCancel.original,
    afterCancel.replacement
  ) ||
  afterCancel.original.status !== 'CANCELLED' ||
  afterCancel.replacement.status !== 'DRAFT'
) {
  throw Error(
    'Post-cancellation verification failed. Stop and inspect.'
  );
}

console.log('OLD INVOICE CANCELLED: VERIFIED');

await updateJournal('OLD_CANCELLED_VERIFIED');

// Now issue the replacement, without sending email.
await updateJournal('SEND_ATTEMPTED');

const sent = await fetch(
  `${BASE}/v2/invoicing/invoices/${newId}/send`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      send_to_recipient: false,
      send_to_invoicer: false
    }),
    signal: AbortSignal.timeout(20000)
  }
);

console.log('SEND HTTP:', sent.status);

if (![200, 202].includes(sent.status)) {
  console.log(
    'Send unconfirmed. Run --status.'
  );
  throw Error('Replacement send not accepted. No retry.');
}

// Final independent verification of BOTH records.
const final = await getBoth();

show(final.original, final.replacement);

const success =
  identityOK(final.original, final.replacement) &&
  final.original.status === 'CANCELLED' &&
  ['UNPAID', 'SENT'].includes(final.replacement.status);

if (!success) {
  throw Error(
    'Final PayPal GET verification failed. Manual review needed.'
  );
}

await updateJournal('RECOVERY_VERIFIED', {
  oldFinalStatus: final.original.status,
  newFinalStatus: final.replacement.status
});

console.log('RECOVERY VERIFICATION: PASS');
console.log('SANDBOX ONLY. NO PAYMENT COLLECTED.');
