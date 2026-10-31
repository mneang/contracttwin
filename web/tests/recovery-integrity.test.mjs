import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyRecoveryState
} from '../lib/recovery-integrity.ts';

function validCase() {
  return {
    journal: {
      oldId: 'INV2-OLD',
      newId: 'INV2-NEW',
      phase: 'RECOVERY_VERIFIED',
      approvedDecision: 'REPLACE',
      governingAgreement: 'B',
      amountOld: 900,
      amountNew: 1200,
      citedClauses: [
        'A-END', 'B-START', 'B-RATE'
      ]
    },
    original: {
      id: 'INV2-OLD',
      status: 'CANCELLED',
      detail: { reference: 'AC-714' },
      amount: {
        currency_code: 'USD',
        value: '900.00'
      }
    },
    replacement: {
      id: 'INV2-NEW',
      status: 'UNPAID',
      detail: { reference: 'AC-714' },
      amount: {
        currency_code: 'USD',
        value: '1200.00'
      }
    }
  };
}

test('verified outcome passes', () => {
  assert.equal(verifyRecoveryState(validCase()), true);
});

test('issued replacement may be SENT', () => {
  const x = validCase();
  x.replacement.status = 'SENT';
  assert.equal(verifyRecoveryState(x), true);
});

const failures = [
  ['original not cancelled',
    x => { x.original.status = 'UNPAID'; }],
  ['original paid',
    x => { x.original.status = 'PAID'; }],
  ['replacement still draft',
    x => { x.replacement.status = 'DRAFT'; }],
  ['replacement payment pending',
    x => { x.replacement.status = 'PAYMENT_PENDING'; }],
  ['wrong replacement amount',
    x => { x.replacement.amount.value = '900.00'; }],
  ['wrong replacement ID',
    x => { x.replacement.id = 'INV2-OTHER'; }],
  ['wrong reference',
    x => { x.replacement.detail.reference = 'WRONG'; }],
  ['wrong currency',
    x => { x.original.amount.currency_code = 'EUR'; }],
  ['unfinished journal',
    x => { x.journal.phase = 'SEND_ATTEMPTED'; }],
  ['approval inconsistent',
    x => { x.journal.approvedDecision = 'ESCALATE'; }],
  ['missing decisive evidence',
    x => { x.journal.citedClauses = ['A-END']; }]
];

for (const [label, mutate] of failures) {
  test(`fail closed: ${label}`, () => {
    const x = validCase();
    mutate(x);
    assert.equal(verifyRecoveryState(x), false);
  });
}
