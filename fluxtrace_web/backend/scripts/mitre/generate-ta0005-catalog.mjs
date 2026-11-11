/**
 * Generates shared/data/mitreTa0005Catalog.json from a saved MITRE tactic page
 * (markdown export or copy of https://attack.mitre.org/tactics/TA0005/).
 * Run: pnpm mitre:ta0005-catalog (ou node backend/scripts/mitre/generate-ta0005-catalog.mjs)
 *
 * Caminho preferido: `pnpm mitre:sync-catalog` (STIX Enterprise oficial, regista a versão ATT&CK e as
 * outras tácticas de cada técnica). Desde a ATT&CK v19 a TA0005 chama-se Stealth; um snapshot
 * com título "Defense Evasion" é anterior à divisão e é recusado.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..", "..");
const src = path.join(__dirname, "ta0005-source.md");
const out = path.join(backendRoot, "shared", "data", "mitreTa0005Catalog.json");

function pathToId(p) {
  // "T1548" | "T1548/001" → "T1548" | "T1548.001"
  const m = p.match(/^T(\d{4})(?:\/(\d{3}))?$/);
  if (!m) return null;
  return m[2] ? `T${m[1]}.${m[2]}` : `T${m[1]}`;
}

function techniqueUrl(id) {
  const dot = id.indexOf(".");
  if (dot === -1) return `https://attack.mitre.org/techniques/${id}/`;
  return `https://attack.mitre.org/techniques/${id.slice(0, dot)}/${id.slice(dot + 1)}/`;
}

const text = fs.readFileSync(src, "utf8");
const lines = text.split(/\r?\n/);

const titleMatch = text.match(/^Title:\s*(.+?),\s*Tactic TA0005/m);
const tacticName = titleMatch ? titleMatch[1].trim() : "Stealth";
if (/defense evasion/i.test(tacticName)) {
  console.error(
    `${path.basename(src)} é um snapshot anterior à ATT&CK v19 ("${tacticName}"). ` +
      "Use `pnpm mitre:sync-catalog` ou guarde de novo https://attack.mitre.org/tactics/TA0005/.",
  );
  process.exit(1);
}

const entries = [];
for (const line of lines) {
  if (!line.trim().startsWith("|")) continue;
  // First cell: Txxxx or .nnn linking to /techniques/T... or /techniques/T.../nnn
  const m = line.match(
    /^\s*\| \[\s*(?:T(\d{4})|\.(\d{3}))\s+\]\(\/techniques\/(T[\d/]+)\)/
  );
  if (!m) continue;
  const id = pathToId(m[3]);
  if (!id) continue;
  const nameCols = [...line.matchAll(/\|\s*\[([^\]]*)\]\(\/techniques\//g)];
  const name = nameCols[1] ? nameCols[1][1].trim() : id;
  entries.push({ id, name, url: techniqueUrl(id) });
}

const seen = new Set();
const unique = [];
for (const e of entries) {
  if (seen.has(e.id)) continue;
  seen.add(e.id);
  unique.push(e);
}

// Stable sort: parent before subs (T1548 before T1548.001)
unique.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

const generatedAt = new Date().toISOString().slice(0, 10);
const catalog = {
  tacticId: "TA0005",
  tacticName,
  source: "https://attack.mitre.org/tactics/TA0005/",
  generatedAt,
  version: `bundled-${generatedAt}`,
  syncedAt: null,
  techniques: unique,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Wrote ${unique.length} techniques to ${out}`);
