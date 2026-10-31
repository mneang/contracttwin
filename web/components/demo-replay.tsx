"use client";

import { useState } from "react";
import case001 from "../fixtures/contract-case-01.json";
import case002 from "../fixtures/contract-case-02.json";
import case003 from "../fixtures/contract-case-03.json";

const scenarios = [
  {
    id: "CASE-001",
    name: "Incorrect renewal",
    description: "October rental uses an expired agreement.",
    decision: "REPLACE",
    agreement: "B",
    amount: 1200,
    evidenceIds: ["A-END", "B-START", "B-RATE"],
    fixture: case001
  },
  {
    id: "CASE-002",
    name: "Legitimate lookalike",
    description: "September maintenance remains collectible.",
    decision: "KEEP",
    agreement: "A",
    amount: 250,
    evidenceIds: ["A-MAINT", "B-SUPER"],
    fixture: case002
  },
  {
    id: "CASE-003",
    name: "Missing evidence",
    description: "A signed rate schedule is unavailable.",
    decision: "ESCALATE",
    agreement: "UNKNOWN",
    amount: null,
    evidenceIds: ["A-AFTER", "B-SCHEDULE"],
    fixture: case003
  }
];

export default function DemoReplay() {
  const [selected, setSelected] = useState(0);
  const scenario = scenarios[selected];

  const evidenceIds = new Set<string>(scenario.evidenceIds);

  const evidence = scenario.fixture.agreements
    .flatMap(agreement => agreement.clauses)
    .filter(clause => evidenceIds.has(clause.id));

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

          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs text-sky-200">
            PUBLIC DEMO · RECORDED REPLAY
          </span>
        </header>

        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            PAYPAL AI HACKATHON · SANDBOX DEMONSTRATION
          </p>

          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The right invoice.
            <span className="block text-sky-300">
              The right agreement.
            </span>
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
            ContractTwin analyzes competing business agreements,
            protects legitimate invoices, and requires human
            approval before correcting an invalid PayPal bill.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.07] p-5">
          <p className="text-sm font-semibold text-sky-200">
            Recorded PayPal Sandbox verification
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The following results were observed in an actual
            sandbox execution on October 31, 2026. This public
            page replays those recorded results. It does not
            contact PayPal or perform a fresh invoice check.
          </p>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Original invoice · Agreement A
            </p>
            <p className="mt-4 text-4xl font-semibold">
              $900.00
            </p>
            <p className="mt-4 text-sm font-semibold text-rose-300">
              CANCELLED
            </p>
            <p className="mt-3 break-all font-mono text-xs text-slate-500">
              INV2-CBPV-HAL6-TUBZ-3BG8
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Corrected invoice · Agreement B
            </p>
            <p className="mt-4 text-4xl font-semibold">
              $1,200.00
            </p>
            <p className="mt-4 text-sm font-semibold text-emerald-300">
              UNPAID
            </p>
            <p className="mt-3 break-all font-mono text-xs text-slate-500">
              INV2-DQWZ-J5TH-L53J-ZFGU
            </p>
          </article>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-2xl font-semibold text-sky-300">
            +$300.00
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Invoice amount corrected. No payment collected.
            This is not recovered revenue.
          </p>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                Contract Decision Lab
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Correct, preserve, or escalate?
              </h2>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-300">
              Recorded scenario outcomes
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Select a synthetic scenario to inspect its
            previously validated outcome and source clauses.
            Selection is an interactive replay, not a new
            Gemini inference request.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {scenarios.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected === index
                    ? "border-sky-400 bg-sky-500/10"
                    : "border-white/10 bg-slate-950/50 hover:border-white/30"
                }`}
              >
                <p className="font-mono text-xs text-sky-300">
                  {item.id}
                </p>
                <p className="mt-2 font-semibold">
                  {item.name}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {item.description}
                </p>
              </button>
            ))}
          </div>

          <div
            aria-live="polite"
            className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
              Recorded validated decision
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {scenario.decision}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">
                  Governing agreement
                </p>
                <p className="mt-1 font-semibold">
                  {scenario.agreement}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">
                  Supported amount
                </p>
                <p className="mt-1 font-semibold">
                  {scenario.amount === null
                    ? "Not determined"
                    : `$${scenario.amount.toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}`}
                </p>
              </div>
            </div>

            <h3 className="mt-7 font-semibold">
              Supporting contract clauses
            </h3>

            <div className="mt-3 space-y-3">
              {evidence.map(clause => (
                <article
                  key={clause.id}
                  className="rounded-lg bg-slate-950/70 p-4"
                >
                  <p className="font-mono text-xs text-sky-300">
                    {clause.id}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {clause.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-white/10 py-7 text-sm text-slate-400">
          <p>
            Fictional agreements · Recorded PayPal sandbox
            result · No live financial actions on this page
          </p>
          <a
            className="mt-3 inline-block text-sky-300 underline underline-offset-4"
            href="https://github.com/mneang/contracttwin"
            target="_blank"
            rel="noopener noreferrer"
          >
            View open-source project and integration code
          </a>
        </footer>
      </div>
    </main>
  );
}
