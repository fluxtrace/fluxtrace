import { describe, expect, it } from "vitest";

import {
  collectAllBehaviourMitreTechniqueIdsFromVtSandboxMap,
  collectFluxtraceDefenseEvasionTechniqueIds,
  collectTa0005TechniqueIdsFromMitreEntry,
  flattenVtBehaviourMitreSandboxData,
} from "./vtBehaviourMitreExport";

describe("flattenVtBehaviourMitreSandboxData", () => {
  it("deduplica IDs, separa TA0005 e recolhe primeiro nome por técnica", () => {
    const vtData = {
      SB1: {
        tactics: [
          {
            id: "TA0007",
            techniques: [{ id: "T1082", name: "Discovery A" }],
          },
          {
            id: "TA0005",
            techniques: [{ id: "T1055", name: "Injection" }],
          },
        ],
      },
      SB2: {
        tactics: [
          {
            id: "TA0005",
            techniques: [{ id: "T1070.004", name: "File Del" }],
          },
        ],
      },
    };
    const flat = flattenVtBehaviourMitreSandboxData(vtData);
    expect(flat.techniqueIdsSorted).toEqual(["T1055", "T1070.004", "T1082"]);
    expect(flat.ta0005TechniqueIdsSorted).toEqual(["T1055", "T1070.004"]);
    expect(flat.techniqueNameByUpper.get("T1055")).toBe("Injection");
    expect(flat.techniqueNameByUpper.get("T1082")).toBe("Discovery A");
  });
});

describe("collectAllBehaviourMitreTechniqueIdsFromVtSandboxMap", () => {
  it("agrega todas as táticas (exemplo alinhado à documentação VirusTotal behaviour_mitre_trees)", () => {
    const vtData = {
      Zenbox: {
        tactics: [
          {
            id: "TA0007",
            name: "Discovery",
            techniques: [
              { id: "T1082", name: "System Information Discovery" },
              { id: "T1083", name: "File and Directory Discovery" },
            ],
          },
          {
            id: "TA0005",
            name: "Defense Evasion",
            techniques: [
              { id: "T1055", name: "Process Injection" },
              { id: "T1070.004", name: "File Deletion" },
            ],
          },
          {
            id: "TA0004",
            name: "Privilege Escalation",
            techniques: [{ id: "T1055", name: "Process Injection" }],
          },
        ],
      },
      "VirusTotal Jujubox": { tactics: [] },
    };

    const ids = collectAllBehaviourMitreTechniqueIdsFromVtSandboxMap(vtData);
    expect(ids).toEqual(["T1055", "T1070.004", "T1082", "T1083"]);
  });
});

describe("collectTa0005TechniqueIdsFromMitreEntry", () => {
  it("mantém só TA0005 num export com wrapper `data`", () => {
    const entry = {
      data: {
        SB: {
          tactics: [
            {
              id: "TA0005",
              techniques: [{ id: "T1055" }, { id: "T1036" }],
            },
            {
              id: "TA0007",
              techniques: [{ id: "T1082" }],
            },
          ],
        },
      },
    };
    expect(collectTa0005TechniqueIdsFromMitreEntry(entry)).toEqual(["T1036", "T1055"]);
  });
});

describe("collectFluxtraceDefenseEvasionTechniqueIds", () => {
  it("lê `mitreDefenseEvasion.techniques[].id`", () => {
    const mitre = {
      techniques: [{ id: "T1055.001" }, { id: "T1027" }],
    };
    expect(collectFluxtraceDefenseEvasionTechniqueIds(mitre)).toEqual(["T1027", "T1055.001"]);
  });
});
