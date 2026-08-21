import { describe, expect, it } from "vitest";

import {
  DEFAULT_RISK_LEVEL_THRESHOLDS,
  deriveRiskLevelFromCounts,
  resolveRiskLevelThresholds,
} from "./riskLevelThresholds";

describe("riskLevelThresholds", () => {
  it("usa defaults do artigo quando o env está vazio", () => {
    expect(resolveRiskLevelThresholds({})).toEqual(DEFAULT_RISK_LEVEL_THRESHOLDS);
  });

  it("respeita overrides RISK_* válidos", () => {
    const t = resolveRiskLevelThresholds({
      RISK_CRITICAL_MIN_TRIGGERS: "9",
      RISK_MEDIUM_MIN_SUSPICIOUS: "1",
    });
    expect(t.criticalMinTriggers).toBe(9);
    expect(t.mediumMinSuspicious).toBe(1);
    expect(t.criticalMinTechniques).toBe(DEFAULT_RISK_LEVEL_THRESHOLDS.criticalMinTechniques);
  });

  it("ignora valores inválidos", () => {
    const t = resolveRiskLevelThresholds({ RISK_CRITICAL_MIN_TRIGGERS: "abc" });
    expect(t.criticalMinTriggers).toBe(DEFAULT_RISK_LEVEL_THRESHOLDS.criticalMinTriggers);
  });

  it("deriveRiskLevelFromCounts com defaults: critical por gatilhos", () => {
    expect(deriveRiskLevelFromCounts(0, 2, 0)).toBe("critical");
  });

  it("deriveRiskLevelFromCounts com defaults: high por técnicas", () => {
    expect(deriveRiskLevelFromCounts(3, 0, 0)).toBe("high");
  });

  it("deriveRiskLevelFromCounts com defaults: medium / low", () => {
    expect(deriveRiskLevelFromCounts(2, 0, 0)).toBe("medium");
    expect(deriveRiskLevelFromCounts(0, 0, 0)).toBe("low");
  });
});
