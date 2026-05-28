import { describe, expect, it } from "vitest";

import { comparativeBreakdownFromBcIdLists } from "./mitreFluxtraceVtTableXlsxExport";

describe("comparativeBreakdownFromBcIdLists", () => {
  it("sem técnicas: vazio", () => {
    const r = comparativeBreakdownFromBcIdLists({
      fluxCanonSorted: [],
      vtTa0005CanonSorted: [],
      fluxNameByUpper: new Map(),
      vtNameByUpper: new Map(),
    });
    expect(r.match.cellText).toBe("");
    expect(r.match.pctForChart).toBe("");
  });

  it("identidade: só match 100% com etiquetas Flux preferidas", () => {
    const fluxNm = new Map([
      ["T1036", "Masquerading"],
      ["T1055", "Process Injection"],
    ]);
    const r = comparativeBreakdownFromBcIdLists({
      fluxCanonSorted: ["T1055", "T1036"],
      vtTa0005CanonSorted: ["T1036", "T1055"],
      fluxNameByUpper: fluxNm,
      vtNameByUpper: new Map([["T1055", "VT Duplicate Name Ignored Until Match"]]),
    });
    expect(r.match.cellText).toBe(
      "100.0%\nT1036 (Masquerading); T1055 (Process Injection)",
    );
    expect(r.onlyFlux.cellText).toBe("0.0%");
    expect(r.onlyVt.cellText).toBe("0.0%");
  });

  it("união tripartida: cada faixa lista os IDs preferindo nomes Flux ou VT conforme a coluna", () => {
    const fluxNm = new Map([
      ["T1055", "Process Injection"],
      ["T1036", "Masquerading"],
    ]);
    const vtNm = new Map([["T1070", "Indicator Removal"]]);
    const r = comparativeBreakdownFromBcIdLists({
      fluxCanonSorted: ["T1055", "T1036"],
      vtTa0005CanonSorted: ["T1055", "T1070"],
      fluxNameByUpper: fluxNm,
      vtNameByUpper: vtNm,
    });
    expect(r.match.cellText).toBe("33.3%\nT1055 (Process Injection)");
    expect(r.onlyFlux.cellText).toBe("33.3%\nT1036 (Masquerading)");
    expect(r.onlyVt.cellText).toBe("33.3%\nT1070 (Indicator Removal)");
    expect(r.match.pctForChart).toBe(33.3);
  });

  it(" casing insensível na correspondência técnica", () => {
    const r = comparativeBreakdownFromBcIdLists({
      fluxCanonSorted: ["t1055"],
      vtTa0005CanonSorted: ["T1055"],
      fluxNameByUpper: new Map([["T1055", "X"]]),
      vtNameByUpper: new Map(),
    });
    expect(r.match.cellText).toContain("100.0%");
    expect(r.match.cellText).toContain("t1055");
  });
});
