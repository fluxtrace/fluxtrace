import { describe, expect, it } from "vitest";

import { diffMitreCatalog, extractTa0005CatalogFromStix, syncMitreCatalog } from "./mitreCatalogSync";

const STIX_FIXTURE = {
  type: "bundle",
  objects: [
    { type: "x-mitre-collection", x_mitre_attack_spec_version: "17.0" },
    {
      type: "attack-pattern",
      name: "Debugger Evasion",
      external_references: [
        { source_name: "mitre-attack", external_id: "T1622", url: "https://attack.mitre.org/techniques/T1622/" },
      ],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "defense-evasion" }],
    },
    {
      type: "attack-pattern",
      name: "Process Injection",
      external_references: [
        { source_name: "mitre-attack", external_id: "T1055", url: "https://attack.mitre.org/techniques/T1055/" },
      ],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "defense-evasion" }],
    },
    {
      type: "attack-pattern",
      name: "Revoked decoy",
      revoked: true,
      external_references: [{ source_name: "mitre-attack", external_id: "T9999" }],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "defense-evasion" }],
    },
    {
      type: "attack-pattern",
      name: "Command and Scripting Interpreter",
      external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
    },
  ],
};

describe("mitreCatalogSync", () => {
  it("extrai só TA0005 do STIX e ignora revoked / outras tácticas", () => {
    const extracted = extractTa0005CatalogFromStix(STIX_FIXTURE);
    expect(extracted.version).toBe("17.0");
    expect(extracted.techniques.map((row) => row.id)).toEqual(["T1055", "T1622"]);
    expect(extracted.techniques[0]?.name).toBe("Process Injection");
  });

  it("detecta IDs novos, removidos e nomes alterados", () => {
    const delta = diffMitreCatalog(
      [
        { id: "T1622", name: "Old Debugger", url: "https://attack.mitre.org/techniques/T1622/" },
        { id: "T1006", name: "Direct Volume Access", url: "https://attack.mitre.org/techniques/T1006/" },
      ],
      [
        { id: "T1622", name: "Debugger Evasion", url: "https://attack.mitre.org/techniques/T1622/" },
        { id: "T1678", name: "Delay Execution", url: "https://attack.mitre.org/techniques/T1678/" },
      ],
    );
    expect(delta.added).toEqual(["T1678"]);
    expect(delta.removed).toEqual(["T1006"]);
    expect(delta.renamed).toEqual([{ id: "T1622", previousName: "Old Debugger", name: "Debugger Evasion" }]);
  });

  it("recusa um STIX sem técnicas suficientes sem gravar", async () => {
    const result = await syncMitreCatalog({
      fetcher: async () => ({ type: "bundle", objects: [] }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/TA0005/);
    }
  });
});
