import { readFile } from "node:fs/promises";
import { verifyRecoveryState } from "../lib/recovery-integrity";
import { Suspense } from "react";
import DemoReplay from "../components/demo-replay";
import CaseLab from "../components/case-lab";
import { connection } from "next/server";


type Invoice = {
  id: string;
  status: string;
  detail?: { reference?: string };
  amount?: {
    currency_code?: string;
    value?: string;
  };
};

type Journal = {
  oldId: string;
  newId: string;
  phase: string;
  citedClauses?: string[];
  updatedAt?: string;
};

type Clause = {
  id: string;
  text: string;
};

type Fixture = {
  agreements: {
    id: string;
    clauses: Clause[];
  }[];
};

async function loadRecovery() {
  const journal: Journal = JSON.parse(
    await readFile(
      "recovery-state/CASE-001.json",
      "utf8"
    )
  );

  if (
    journal.phase !== "RECOVERY_VERIFIED" ||
    journal.oldId !==
      process.env.CONTRACTTWIN_TEST_INVOICE_ID ||
    !/^INV2-[A-Za-z0-9-]+$/.test(journal.newId)
  ) {
    throw new Error("Recovery journal is not verified.");
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials unavailable.");
  }

  // All authentication stays on the server.
  const basic = Buffer.from(
    `${clientId}:${secret}`
  ).toString("base64");

  const auth = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!auth.ok) {
    throw new Error("PayPal authentication failed.");
  }

  const { access_token: token } = await auth.json();

  if (!token) {
    throw new Error("PayPal token unavailable.");
  }

  async function fetchInvoice(id: string): Promise<Invoice> {
    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!response.ok) {
      throw new Error("PayPal invoice read failed.");
    }

    return response.json();
  }

  // Two independent, fresh PayPal reads.
  const [original, replacement] = await Promise.all([
    fetchInvoice(journal.oldId),
    fetchInvoice(journal.newId)
  ]);

  const verified = verifyRecoveryState({
    original,
    replacement,
    journal
  });

  if (!verified) {
    throw new Error(
      "The current PayPal states do not match the recovery."
    );
  }

  const fixture: Fixture = JSON.parse(
    await readFile(
      "fixtures/contract-case-01.json",
      "utf8"
    )
  );

  const clauses = fixture.agreements.flatMap(
    (agreement) => agreement.clauses
  );

  const evidence = (journal.citedClauses ?? [])
    .map((id) => clauses.find((clause) => clause.id === id))
    .filter((clause): clause is Clause => Boolean(clause));

  if (
    !["A-END", "B-START", "B-RATE"].every(
      (id) => evidence.some((clause) => clause.id === id)
    )
  ) {
    throw new Error("Recorded contract evidence incomplete.");
  }

  return {
    original,
    replacement,
    journal,
    evidence,
    checkedAt: new Date().toISOString()
  };
}

async function RecoveryScreen() {
  await connection();
  let result: Awaited<ReturnType<typeof loadRecovery>> | null =
    null;

  try {
    result = await loadRecovery();
  } catch {
    // Never display a fake success when PayPal is unavailable.
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-5 py-8 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-sky-400">
              CONTRACTTWIN
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Invoice Integrity & Recovery
            </p>
          </div>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-300">
            PAYPAL SANDBOX · READ ONLY
          </span>
        </header>

        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            CASE 001 · AGREEMENT AC-714
          </p>

          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            The right invoice. The right agreement.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            An expired rental agreement produced an incorrect
            invoice. ContractTwin investigated the amendment,
            required approval, and verified the corrected
            PayPal billing state.
          </p>
        </section>

        {!result ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8">
            <h2 className="text-xl font-semibold text-amber-200">
              Verification unavailable
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The recovery journal, contract evidence, or
              current PayPal state could not be verified.
              No success result is displayed.
              Check your server terminal and sandbox setup.
            </p>
            <a
              href="/"
              className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Retry read-only verification
            </a>
          </section>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xl text-emerald-300">✓</span>
                <div>
                  <p className="font-semibold text-emerald-200">
                    Recovery independently verified
                  </p>
                  <p className="text-xs text-emerald-100/70">
                    Both invoice states fetched from PayPal
                  </p>
                </div>
              </div>
              <a
                href="/"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
              >
                Refresh PayPal state
              </a>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                {
                  label: "Original · Agreement A",
                  invoice: result.original,
                  description: "Incorrect October rental bill",
                  accent: "text-rose-300"
                },
                {
                  label: "Replacement · Agreement B",
                  invoice: result.replacement,
                  description: "Correct October rental bill",
                  accent: "text-emerald-300"
                }
              ].map((card) => (
                <article
                  key={card.invoice.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <p className="text-sm text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-5 text-4xl font-semibold tabular-nums">
                    ${Number(card.invoice.amount?.value).toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }
                    )}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {card.description}
                  </p>
                  <p className={`mt-6 text-sm font-semibold ${card.accent}`}>
                    ● {card.invoice.status}
                  </p>
                  <p className="mt-3 break-all font-mono text-xs text-slate-500">
                    {card.invoice.id}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Billing integrity outcome
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <p className="text-3xl font-semibold text-sky-300">
                  +$300.00
                </p>
                <p className="pb-1 text-sm text-slate-400">
                  Correction to invoice amount
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                This is an issued sandbox payment request,
                not a collected payment or recovered revenue.
              </p>
            </div>

            <CaseLab />

            <div className="mt-5 grid gap-5 lg:grid-cols-5">
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-3">
                <p className="text-xs uppercase tracking-widest text-sky-400">
                  Recorded AI evidence · Fictional contracts
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Why Agreement B governs the charge
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Gemini selected REPLACE during the recorded
                  investigation. These are the cited source
                  clauses from our synthetic test case.
                  This page does not rerun the model.
                </p>

                <div className="mt-6 space-y-4">
                  {result.evidence.map((clause) => (
                    <div
                      key={clause.id}
                      className="rounded-xl bg-slate-900/80 p-4"
                    >
                      <p className="font-mono text-xs font-semibold text-sky-300">
                        {clause.id}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {clause.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-2">
                <p className="text-xs uppercase tracking-widest text-sky-400">
                  Verified action history
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Recovery audit
                </h2>

                <div className="mt-7 space-y-5">
                  {[
                    "Contract evidence analyzed",
                    "Corrected draft created and checked",
                    "Operator approved both invoice IDs",
                    "Original invoice cancelled and verified",
                    "Replacement issued and verified"
                  ].map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-sm text-slate-300">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-7 border-t border-white/10 pt-5 text-xs text-slate-500">
                  Journal phase: {result.journal.phase}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  PayPal rechecked: {result.checkedAt} UTC
                </p>
              </section>
            </div>

            <footer className="mt-10 border-t border-white/10 py-6 text-xs text-slate-500">
              ContractTwin · Synthetic business agreements ·
              PayPal Sandbox · No customer emails or payments
              collected in this demonstration
            </footer>
          </>
        )}
      </div>
    </main>
  );
}


export default function Home() {
  if (process.env.NODE_ENV === "production") {
    return <DemoReplay />;
  }
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0b1220] px-6 py-12 text-slate-100">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-widest text-sky-400">
              CONTRACTTWIN
            </p>
            <h1 className="mt-5 text-3xl font-semibold">
              Verifying invoice recovery
            </h1>
            <p className="mt-3 text-slate-400">
              Reading current PayPal sandbox invoice states...
            </p>
          </div>
        </main>
      }
    >
      <RecoveryScreen />
    </Suspense>
  );
}
