/**
 * Substitui no xlsx URLs antigas (repo margefson …/legacy_artifacts)
 * por https://github.com/fluxtrace/fluxtrace/tree/main/funcoes-mapeadas…
 *
 * Uso em `fluxtrace_web/`: `pnpm exec tsx backend/scripts/patch-fluxos-github-base.mts`
 * Opcional: `FUNCOES_MAPEADAS=C:/abs/para/pasta` ou `--file=D:/…/fluxos_mapeados.xlsx`
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import process from "node:process";

import XLSX from "xlsx";

const NEW_BASE = "https://github.com/fluxtrace/fluxtrace/tree/main/funcoes-mapeadas";

const OLD_PREFIX_ESCAPED =
  /^https:\/\/github\.com\/margefson\/AI_correlacion_contradef\/tree\/main\/legacy_artifacts/i;

const OLD_LITERAL = "https://github.com/margefson/AI_correlacion_contradef/tree/main/legacy_artifacts";

function rewriteFluxoCell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (!t) return value;
  if (OLD_PREFIX_ESCAPED.test(t)) {
    const rest = t.slice(OLD_LITERAL.length).replace(/^\/+/u, "");
    return rest.length > 0 ? `${NEW_BASE}/${rest}` : NEW_BASE;
  }
  return value;
}

function resolveWorkbookPath(argv: string[]): string {
  const fileArg = argv.find(a => a.startsWith("--file="))?.slice("--file=".length).trim();
  if (fileArg) return path.resolve(fileArg);
  const env = process.env.FUNCOES_MAPEADAS?.trim();
  if (env) return path.join(path.resolve(env), "fluxos_mapeados.xlsx");
  const fm = path.resolve(process.cwd(), "..", "funcoes-mapeadas", "fluxos_mapeados.xlsx");
  const legacy = path.resolve(process.cwd(), "..", "legacy_artifacts", "fluxos_mapeados.xlsx");
  if (existsSync(fm)) return fm;
  return legacy;
}

const wp = resolveWorkbookPath(process.argv.slice(2));
if (!existsSync(wp)) {
  console.error(`Ficheiro não encontrado: ${wp}`);
  process.exit(1);
}

const buf = readFileSync(wp);
const wb = XLSX.read(buf, { type: "buffer" });
const SHEET = wb.SheetNames.includes("M1") ? "M1" : (wb.SheetNames[0] ?? "M1");
const sheet = wb.Sheets[SHEET];
if (!sheet) {
  console.error("Planilha vazia.");
  process.exit(1);
}

const aoa = XLSX.utils.sheet_to_json<unknown[][]>(sheet, { header: 1, blankrows: false }) as unknown[][];
let changed = 0;
for (let r = 0; r < aoa.length; r++) {
  const row = aoa[r];
  if (!Array.isArray(row) || row.length < 2) continue;
  const next = rewriteFluxoCell(row[1]);
  if (next !== row[1]) {
    row[1] = next;
    changed++;
  }
}

const out = XLSX.utils.aoa_to_sheet(aoa);
wb.Sheets[SHEET] = out;
const outBuf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
writeFileSync(wp, outBuf);
console.log(`OK: actualizado fluxos_mapeados.xlsx (${changed} URLs na coluna «Fluxo gerado»).`);
