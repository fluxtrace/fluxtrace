/**
 * Limiares de `deriveRiskLevel` (classificação critical/high/medium/low).
 *
 * Valores padrão = os usados nos experimentos SBSeg 2026 / CTA.
 * Externalizados via env para calibração sem alterar o código-fonte.
 * Não afetam a métrica de redução de linhas (ρ).
 *
 * | Variável | Default | Papel |
 * |----------|---------|--------|
 * | RISK_CRITICAL_MIN_TRIGGERS | 2 | gatilhos ≥ → critical |
 * | RISK_CRITICAL_MIN_TECHNIQUES | 5 | técnicas MITRE distintas ≥ → critical |
 * | RISK_CRITICAL_MIN_SUSPICIOUS | 20 | eventos suspeitos ≥ → critical |
 * | RISK_HIGH_MIN_TRIGGERS | 1 | |
 * | RISK_HIGH_MIN_TECHNIQUES | 3 | |
 * | RISK_HIGH_MIN_SUSPICIOUS | 10 | |
 * | RISK_MEDIUM_MIN_TECHNIQUES | 2 | |
 * | RISK_MEDIUM_MIN_SUSPICIOUS | 5 | |
 */

export type RiskLevelThresholds = {
  criticalMinTriggers: number;
  criticalMinTechniques: number;
  criticalMinSuspicious: number;
  highMinTriggers: number;
  highMinTechniques: number;
  highMinSuspicious: number;
  mediumMinTechniques: number;
  mediumMinSuspicious: number;
};

/** Defaults alinhados ao motor avaliado no CTA (commit 5618c23 e sucessores). */
export const DEFAULT_RISK_LEVEL_THRESHOLDS: RiskLevelThresholds = {
  criticalMinTriggers: 2,
  criticalMinTechniques: 5,
  criticalMinSuspicious: 20,
  highMinTriggers: 1,
  highMinTechniques: 3,
  highMinSuspicious: 10,
  mediumMinTechniques: 2,
  mediumMinSuspicious: 5,
};

function readPositiveIntFrom(env: NodeJS.ProcessEnv, envKey: string, fallback: number): number {
  const raw = env[envKey]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Lê limiares do ambiente; valores inválidos caem no default do artigo. */
export function resolveRiskLevelThresholds(
  env: NodeJS.ProcessEnv = process.env,
): RiskLevelThresholds {
  const d = DEFAULT_RISK_LEVEL_THRESHOLDS;
  return {
    criticalMinTriggers: readPositiveIntFrom(env, "RISK_CRITICAL_MIN_TRIGGERS", d.criticalMinTriggers),
    criticalMinTechniques: readPositiveIntFrom(env, "RISK_CRITICAL_MIN_TECHNIQUES", d.criticalMinTechniques),
    criticalMinSuspicious: readPositiveIntFrom(env, "RISK_CRITICAL_MIN_SUSPICIOUS", d.criticalMinSuspicious),
    highMinTriggers: readPositiveIntFrom(env, "RISK_HIGH_MIN_TRIGGERS", d.highMinTriggers),
    highMinTechniques: readPositiveIntFrom(env, "RISK_HIGH_MIN_TECHNIQUES", d.highMinTechniques),
    highMinSuspicious: readPositiveIntFrom(env, "RISK_HIGH_MIN_SUSPICIOUS", d.highMinSuspicious),
    mediumMinTechniques: readPositiveIntFrom(env, "RISK_MEDIUM_MIN_TECHNIQUES", d.mediumMinTechniques),
    mediumMinSuspicious: readPositiveIntFrom(env, "RISK_MEDIUM_MIN_SUSPICIOUS", d.mediumMinSuspicious),
  };
}

export type RiskLevel = "critical" | "high" | "medium" | "low";

/**
 * Classifica risco a partir de contagens do lote.
 * Ordem: critical → high → medium → low (primeiro limiar satisfeito).
 */
export function deriveRiskLevelFromCounts(
  techniquesSize: number,
  triggerCount: number,
  suspiciousCount: number,
  thresholds: RiskLevelThresholds = resolveRiskLevelThresholds(),
): RiskLevel {
  const t = thresholds;
  if (
    triggerCount >= t.criticalMinTriggers ||
    techniquesSize >= t.criticalMinTechniques ||
    suspiciousCount >= t.criticalMinSuspicious
  ) {
    return "critical";
  }
  if (
    triggerCount >= t.highMinTriggers ||
    techniquesSize >= t.highMinTechniques ||
    suspiciousCount >= t.highMinSuspicious
  ) {
    return "high";
  }
  if (techniquesSize >= t.mediumMinTechniques || suspiciousCount >= t.mediumMinSuspicious) {
    return "medium";
  }
  return "low";
}
