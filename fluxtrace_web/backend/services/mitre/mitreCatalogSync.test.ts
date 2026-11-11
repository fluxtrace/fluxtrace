import { describe, expect, it } from "vitest";

import { diffMitreCatalog, extractTa0005CatalogFromStix, syncMitreCatalog } from "./mitreCatalogSync";

const tactic = (id: string, name: string, shortname: string) => ({
  type: "x-mitre-tactic",
  name,
  x_mitre_shortname: shortname,
  external_references: [{ source_name: "mitre-attack", external_id: id }],
});

const technique = (id: string, name: string, phases: string[], extra: Record<string, unknown> = {}) => ({
  type: "attack-pattern",
  name,
  external_references: [{ source_name: "mitre-attack", external_id: id }],
  kill_chain_phases: phases.map((phase_name) => ({ kill_chain_name: "mitre-attack", phase_name })),
  ...extra,
});

/** Formato da ATT&CK v19+: TA0005 = Stealth (fase `stealth`), Defense Impairment = TA0112. */
const STIX_V20_FIXTURE = {
  type: "bundle",
  objects: [
    { type: "x-mitre-collection", x_mitre_version: "20.1", x_mitre_attack_spec_version: "3.3.0" },
    tactic("TA0005", "Stealth", "stealth"),
    tactic("TA0007", "Discovery", "discovery"),
    tactic("TA0004", "Privilege Escalation", "privilege-escalation"),
    tactic("TA0112", "Defense Impairment", "defense-impairment"),
    technique("T1622", "Debugger Evasion", ["stealth", "discovery"]),
    technique("T1055.002", "Portable Executable Injection", ["stealth", "privilege-escalation"]),
    technique("T1027.007", "Dynamic API Resolution", ["stealth"]),
    technique("T1562", "Impair Defenses", ["stealth"], { revoked: true }),
    technique("T1685", "Disable or Modify Tools", ["defense-impairment"]),
    technique("T1059", "Command and Scripting Interpreter", ["execution"]),
  ],
};

/** Formato anterior à v19: TA0005 = Defense Evasion (fase `defense-evasion`). */
const STIX_LEGACY_FIXTURE = {
  type: "bundle",
  objects: [
    { type: "x-mitre-collection", x_mitre_version: "18.0", x_mitre_attack_spec_version: "3.2.0" },
    tactic("TA0005", "Defense Evasion", "defense-evasion"),
    technique("T1622", "Debugger Evasion", ["defense-evasion"]),
    technique("T1055", "Process Injection", ["defense-evasion", "privilege-escalation"]),
    technique("T9999", "Revoked decoy", ["defense-evasion"], { revoked: true }),
  ],
};

describe("mitreCatalogSync", () => {
  it("v20: extrai a TA0005 (Stealth), a versão da ATT&CK e as outras tácticas de cada técnica", () => {
    const extracted = extractTa0005CatalogFromStix(STIX_V20_FIXTURE);
    expect(extracted.version).toBe("20.1");
    expect(extracted.attackSpecVersion).toBe("3.3.0");
    expect(extracted.tacticName).toBe("Stealth");
    expect(extracted.techniques.map((row) => row.id)).toEqual(["T1027.007", "T1055.002", "T1622"]);
    const byId = new Map(extracted.techniques.map((row) => [row.id, row]));
    expect(byId.get("T1622")?.otherTactics).toEqual([{ id: "TA0007", name: "Discovery" }]);
    expect(byId.get("T1055.002")?.otherTactics).toEqual([{ id: "TA0004", name: "Privilege Escalation" }]);
    expect(byId.get("T1027.007")?.otherTactics).toBeUndefined();
  });

  it("formato anterior à v19: continua a ler a fase defense-evasion e ignora revoked", () => {
    const extracted = extractTa0005CatalogFromStix(STIX_LEGACY_FIXTURE);
    expect(extracted.version).toBe("18.0");
    expect(extracted.tacticName).toBe("Defense Evasion");
    expect(extracted.techniques.map((row) => row.id)).toEqual(["T1055", "T1622"]);
    expect(extracted.techniques[0]?.otherTactics).toEqual([{ id: "privilege-escalation", name: "privilege-escalation" }]);
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
