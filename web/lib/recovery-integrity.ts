export type InvoiceProof = {
  id?: string;
  status?: string;
  detail?: { reference?: string };
  amount?: {
    currency_code?: string;
    value?: string;
  };
};

export type RecoveryProof = {
  oldId?: string;
  newId?: string;
  phase?: string;
  approvedDecision?: string;
  governingAgreement?: string;
  amountOld?: number;
  amountNew?: number;
  citedClauses?: string[];
};

export function verifyRecoveryState(input: {
  original: InvoiceProof;
  replacement: InvoiceProof;
  journal: RecoveryProof;
}): boolean {
  const { original, replacement, journal } = input;

  return (
    journal.phase === 'RECOVERY_VERIFIED' &&
    journal.approvedDecision === 'REPLACE' &&
    journal.governingAgreement === 'B' &&
    journal.amountOld === 900 &&
    journal.amountNew === 1200 &&
    ['A-END', 'B-START', 'B-RATE'].every(
      id => journal.citedClauses?.includes(id) === true
    ) &&
    original.id === journal.oldId &&
    replacement.id === journal.newId &&
    original.id !== replacement.id &&
    original.status === 'CANCELLED' &&
    ['UNPAID', 'SENT'].includes(
      replacement.status || ''
    ) &&
    original.detail?.reference === 'AC-714' &&
    replacement.detail?.reference === 'AC-714' &&
    original.amount?.currency_code === 'USD' &&
    replacement.amount?.currency_code === 'USD' &&
    original.amount?.value != null &&
    replacement.amount?.value != null &&
    Number(original.amount.value) === 900 &&
    Number(replacement.amount.value) === 1200
  );
}
