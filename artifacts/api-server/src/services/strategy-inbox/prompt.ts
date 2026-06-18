/**
 * Phase B — Strategy Inbox analysis prompt.
 *
 * Turns a raw inbox item (campaign idea / company goal / format test /
 * feedback) into a structured assessment: feasibility, timeline, resources,
 * risks, and which upcoming week to slot it into.
 */
import type { Brand, StrategyInputType } from "@workspace/db/schema";
import { buildBrandContextSection } from "../ads-strategy/prompt-builder";

export const STRATEGY_INBOX_PROMPT_VERSION = "g-inbox-v1";

export const STRATEGY_INBOX_SYSTEM_PROMPT =
  "Du bist die Virtual Marketing Managerin der Thai Hoang GmbH (DACH, Allgäu/Bodensee/Bayern). " +
  "Du bewertest eingehende Marketing-Ideen, Unternehmensziele, Format-Experimente und Kundenfeedback " +
  "pragmatisch und ehrlich für ein KMU mit kleinem Budget. Antworte AUSSCHLIESSLICH mit gültigem JSON " +
  "im vorgegebenen Schema. Erkläre auf Deutsch, knapp und umsetzbar. Versprich keine Rabatte.";

const INPUT_TYPE_LABEL: Record<StrategyInputType, string> = {
  campaign_idea: "Kampagnen-Idee",
  company_goal: "Unternehmensziel",
  format_test: "Format-Experiment",
  feedback: "Kundenfeedback",
  other: "Sonstiges",
};

export type StrategyInboxPromptInput = {
  inputType: StrategyInputType;
  content: string;
  priority: "high" | "medium" | "low";
  deadline?: string | null;
  outputLanguage?: "de" | "vi" | "en";
};

const LANG_LABEL: Record<"de" | "vi" | "en", string> = {
  de: "Deutsch",
  vi: "Vietnamesisch",
  en: "Englisch",
};

/**
 * Brand may be null → the item applies to ALL brands; we tell the model so it
 * gives portfolio-level advice instead of single-brand specifics.
 */
export function buildStrategyInboxUserPrompt(
  input: StrategyInboxPromptInput,
  brand: Brand | null,
): string {
  const brandSection = brand
    ? buildBrandContextSection(brand)
    : "=== BRAND CONTEXT ===\n(Gilt für ALLE Marken der Thai Hoang GmbH — gib eine portfolioweite Einschätzung.)\n=== END BRAND CONTEXT ===";

  const lang = LANG_LABEL[input.outputLanguage ?? "de"];

  return `${brandSection}

=== EINGABE ===
Typ: ${INPUT_TYPE_LABEL[input.inputType]}
Priorität: ${input.priority}
Deadline: ${input.deadline ?? "(keine)"}
Inhalt:
"""${input.content.slice(0, 4000)}"""
=== ENDE EINGABE ===

Aufgabe: Analysiere diese Eingabe als Marketing-Managerin. Antworte NUR mit JSON in genau diesem Schema (Erklärungen auf ${lang}):
{
  "summary": "1-2 Sätze, was das ist und deine Kernempfehlung",
  "feasibility": { "rating": "high|medium|low", "rationale": "warum, knapp" },
  "timeline": "realistischer Zeitrahmen (z.B. 'in Woche 24 starten, 2 Wochen Laufzeit')",
  "resources": ["benötigte Ressourcen, je 1 String"],
  "risks": ["konkrete Risiken/Vorbehalte, je 1 String"],
  "recommendedWeek": "z.B. 'KW 24' oder 'nächste Woche' oder 'Backlog'",
  "alignsWithTrends": "optional: passt das zu aktuellen Trends? sonst null"
}`;
}
