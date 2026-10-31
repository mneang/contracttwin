"use client";

import { useState } from "react";

type CaseId = "CASE-001" | "CASE-002" | "CASE-003";

type Finding = {
  caseId: string;
  model: string;
  validation: string;
  decision: "REPLACE" | "KEEP" | "ESCALATE";
  governing_agreement_id: string;
  proposed_amount_usd: number | null;
  evidence: {
    clause_id: string;
    quote: string;
  }[];
  explanation: string;
};

const scenarios: {
  id: CaseId;
  title: string;
  description: string;
}[] = [
  {
    id: "CASE-001",
    title: "Incorrect renewal",
    description: "October rental billed under an expired agreement."
  },
  {
    id: "CASE-002",
    title: "Legitimate lookalike",
    description: "September maintenance remains collectible."
  },
  {
    id: "CASE-003",
    title: "Missing evidence",
    description: "An unsigned schedule prevents a safe decision."
  }
];

export default function CaseLab() {
  const [caseId, setCaseId] = useState<CaseId>("CASE-001");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setFinding(null);
    setError("");

    try {
      const response = await fetch("/api/case-lab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({ caseId }),
        signal: AbortSignal.timeout(75000)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Analysis request failed."
        );
      }

      setFinding(data as Finding);
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (
          error.name === "TimeoutError" ||
          error.name === "AbortError"
        );

      setError(
        timedOut
          ? "The analysis exceeded its time limit. No financial records were changed."
          : error instanceof Error
            ? error.message
            : "Analysis unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-sky-500/25 bg-white/[0.04] p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            Interactive AI Case Lab
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Correct, preserve, or escalate?
          </h2>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-300">
          Synthetic cases · No PayPal mutations
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Choose a fictional billing scenario and run Gemini live.
        ContractTwin independently checks the model's decision,
        amount, and cited contract clauses before displaying it.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            type="button"
            disabled={loading}
            aria-pressed={caseId === scenario.id}
            onClick={() => {
              setCaseId(scenario.id);
              setFinding(null);
              setError("");
            }}
            className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
              caseId === scenario.id
                ? "border-sky-400 bg-sky-500/10"
                : "border-white/10 bg-slate-900/60 hover:border-white/30"
            }`}
          >
            <p className="font-mono text-xs text-sky-300">
              {scenario.id}
            </p>
            <p className="mt-2 font-semibold">
              {scenario.title}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {scenario.description}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="rounded-lg bg-sky-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-300 disabled:opacity-60"
        >
          {loading
            ? "Analyzing contract evidence..."
            : "Run live AI analysis"}
        </button>

        <span className="text-xs text-slate-400">
          Executes a real Gemini API request.
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200"
        >
          {error}
        </div>
      )}

      {finding && (
        <div
          aria-live="polite"
          className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-300">
                LIVE ANALYSIS · VALIDATION PASSED
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {finding.decision}
              </p>
            </div>

            <span className="rounded-full border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">
              Evidence verified
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">
                Governing agreement
              </p>
              <p className="mt-1 font-semibold">
                {finding.governing_agreement_id}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                Supported amount
              </p>
              <p className="mt-1 font-semibold">
                {finding.proposed_amount_usd === null
                  ? "Not determined"
                  : `$${finding.proposed_amount_usd.toLocaleString(
                      "en-US",
                      { minimumFractionDigits: 2 }
                    )}`}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-300">
            {finding.explanation}
          </p>

          <h3 className="mt-6 font-semibold">
            Exact source quotations
          </h3>

          <div className="mt-3 space-y-3">
            {finding.evidence.map((item, index) => (
              <div
                key={`${item.clause_id}-${index}`}
                className="rounded-lg bg-slate-950/70 p-4"
              >
                <p className="font-mono text-xs text-sky-300">
                  {item.clause_id}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  "{item.quote}"
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs text-slate-400">
            Model: {finding.model}. The decision and citations
            passed this fixture's validation checks.
            No PayPal records were changed.
          </p>
        </div>
      )}
    </section>
  );
}
