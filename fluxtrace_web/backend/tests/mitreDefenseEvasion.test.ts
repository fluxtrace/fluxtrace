import { describe, expect, it } from "vitest";

import {
  buildMitreDefenseEvasion,
  buildMitreDefenseEvasionFromEvidence,
  listHeuristicsOutsideTa0005,
  MITRE_ATTACK_VERSION,
  MITRE_TA0005_CATALOG,
  MITRE_TA0005_CATALOG_ENTRY_COUNT,
  MITRE_TA0005_PARENT_TECHNIQUE_COUNT,
} from "../shared/mitre/mitreDefenseEvasion";

const ALL_APIS = [
  "GetProcAddress",
  "WriteProcessMemory",
  "EnumSystemFirmwareTables",
  "GetTickCount",
  "IsDebuggerPresent",
  "Sleep",
  "DeleteFile",
];
const ALL_TAGS = [
  "Anti-debug",
  "Atraso deliberado",
  "Transição RW→RX",
  "Injeção de código",
  "Manipulação de arquivos",
  "Detecção de VM",
  "Verificação de overhead",
];

describe("buildMitreDefenseEvasion", () => {
  it("refina VM vs checagem temporal em sub-técnicas distintas (T1497.001 e T1497.003)", () => {
    const result = buildMitreDefenseEvasion(["Detecção de VM", "Verificação de overhead"]);
    expect(result.tacticId).toBe("TA0005");
    expect(result.tacticTechniqueCount).toBe(MITRE_TA0005_PARENT_TECHNIQUE_COUNT);
    expect(result.tacticParentTechniqueCount).toBe(MITRE_TA0005_PARENT_TECHNIQUE_COUNT);
    expect(result.tacticCatalogEntryCount).toBe(MITRE_TA0005_CATALOG_ENTRY_COUNT);
    const ids = result.techniques.map((t) => t.id).sort();
    expect(ids).toEqual(["T1497.001", "T1497.003"]);
  });

  it("regista a versão da ATT&CK e o nome actual da TA0005 (Stealth desde a v19)", () => {
    const result = buildMitreDefenseEvasion(["Anti-debug"]);
    expect(MITRE_ATTACK_VERSION).toMatch(/^\d+\.\d+$/);
    expect(Number(MITRE_ATTACK_VERSION.split(".")[0])).toBeGreaterThanOrEqual(19);
    expect(result.attackVersion).toBe(MITRE_ATTACK_VERSION);
    expect(result.tacticName).toBe("Stealth");
  });

  it("todos os IDs emitidos pelo motor existem na TA0005 do catálogo embutido", () => {
    const catalogIds = new Set(MITRE_TA0005_CATALOG.techniques.map((t) => t.id));
    const result = buildMitreDefenseEvasion(ALL_TAGS, ALL_APIS);
    const withRemote = buildMitreDefenseEvasion([], ["CreateRemoteThread", "RtlQueryPerformanceCounter", "NtDelayExecution"]);
    const emitted = [...result.techniques, ...withRemote.techniques].map((t) => t.id);
    expect(emitted.length).toBeGreaterThanOrEqual(11);
    expect(emitted.filter((id) => !catalogIds.has(id))).toEqual([]);
  });

  it("lista as outras tácticas da técnica (T1622/T1497 em Discovery; T1055 em Privilege Escalation)", () => {
    const result = buildMitreDefenseEvasion(ALL_TAGS, ALL_APIS);
    const other = (id: string) => result.techniques.find((t) => t.id === id)?.otherTactics?.map((t) => t.id);
    expect(other("T1622")).toEqual(["TA0007"]);
    expect(other("T1497.001")).toEqual(["TA0007"]);
    expect(other("T1497.003")).toEqual(["TA0007"]);
    expect(other("T1055.002")).toEqual(["TA0004"]);
    expect(other("T1027.007")).toEqual([]);
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
