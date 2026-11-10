import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { readLinesLf } from "./lfLineReader";

describe("readLinesLf", () => {
  let dir = "";
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("não parte a linha num \\r isolado (parâmetro binário do Pin)", async () => {
    dir = await mkdtemp(join(tmpdir(), "lf-"));
    const path = join(dir, "x.cdf");
    await writeFile(path, Buffer.from("a\r\n        lpLibFileName: \u00ff\r_\nRetorno LoadLibraryA: 0x1\r\nfim", "latin1"));
    const lines: string[] = [];
    for await (const line of readLinesLf(path)) lines.push(line);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe("Retorno LoadLibraryA: 0x1");
    expect(lines[3]).toBe("fim");
  });
});
