import { describe, expect, it } from "vitest";

import {
  buildMitreDefenseEvasion,
  buildMitreDefenseEvasionFromEvidence,
  listHeuristicsOutsideTa0005,
  MITRE_TA0005_CATALOG_ENTRY_COUNT,
} from "../shared/mitre/mitreDefenseEvasion";

describe("buildMitreDefenseEvasion", () => {
  it("refina VM vs checagem temporal em sub-técnicas distintas (T1497.001 e T1497.003)", () => {
    const result = buildMitreDefenseEvasion(["Detecção de VM", "Verificação de overhead"]);
    expect(result.tacticId).toBe("TA0005");
    expect(result.tacticTechniqueCount).toBe(47);
    expect(result.tacticParentTechniqueCount).toBe(47);
    expect(result.tacticCatalogEntryCount).toBe(MITRE_TA0005_CATALOG_ENTRY_COUNT);
    const ids = result.techniques.map((t) => t.id).sort();
    expect(ids).toEqual(["T1497.001", "T1497.003"]);
  });

  it("mapeia GetProcAddress para T1027.007; VirtualProtect só pelo nome não dá T1027", () => {
    const result = buildMitreDefenseEvasion([], ["GetProcAddress", "VirtualProtect"]);
    expect(result.techniques.some((t) => t.id === "T1027.007")).toBe(true);
    expect(result.techniques.some((t) => t.id === "T1027")).toBe(false);
  });

  it("T1027 exige a etiqueta de protecção executável observada", () => {
    const result = buildMitreDefenseEvasion(["Transição RW→RX"], ["VirtualProtect"]);
    expect(result.techniques.some((t) => t.id === "T1027")).toBe(true);
  });

  it("mapeia ZwQueryInformationProcess para T1622 (paridade com NtQueryInformationProcess)", () => {
    const result = buildMitreDefenseEvasion([], ["ZwQueryInformationProcess"]);
    const t1622 = result.techniques.find((t) => t.id === "T1622");
    expect(t1622).toBeDefined();
    expect(t1622!.heuristicEvidence.some((e) => e.label.includes("ZwQueryInformationProcess"))).toBe(true);
  });

  it("preenche ocorrências quando eventos e mapa ficheiro+linha → nó coincidem", () => {
    const fileLineKey = `Log.txt\0${String(12)}`;
    const fileLineToNodeId = new Map<string, string>([[fileLineKey, "event:0:GetProcAddress"]]);
    const result = buildMitreDefenseEvasionFromEvidence({
      heuristicTags: [],
      suspiciousApis: ["GetProcAddress"],
      events: [
        {
          fileName: "Log.txt",
          lineNumber: 12,
          stage: "Desempacotamento",
          suspicious: true,
          suspiciousApis: ["GetProcAddress"],
          techniqueTags: [],
        },
      ],
      fileLineToNodeId,
    });
    const t1027007 = result.techniques.find((t) => t.id === "T1027.007");
    expect(t1027007).toBeDefined();
    const ev = t1027007!.heuristicEvidence.find((e) => e.label.includes("GetProcAddress"));
    expect(ev?.occurrences).toHaveLength(1);
    expect(ev?.occurrences[0]).toMatchObject({
      fileName: "Log.txt",
      lineNumber: 12,
      graphNodeId: "event:0:GetProcAddress",
      phaseNodeId: "phase:Desempacotamento",
    });
  });

  it("ignora heurísticas que não mapeiam para TA0005", () => {
    const result = buildMitreDefenseEvasion(["Comunicação de rede", "Anti-debug"]);
    expect(result.techniques.map((t) => t.id)).toEqual(["T1622"]);
  });
});

describe("listHeuristicsOutsideTa0005", () => {
  it("lista apenas tags sem mapeamento de evasão", () => {
    expect(listHeuristicsOutsideTa0005(["Anti-debug", "Persistência"]).sort()).toEqual(["Persistência"]);
  });
});
