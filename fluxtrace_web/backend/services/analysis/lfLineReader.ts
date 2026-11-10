import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";

/**
 * Linhas separadas só por `\n` (um `\r` final é removido), como sed e editores.
 * `node:readline` também parte em `\r` isolado, que o Pin grava dentro de parâmetros
 * binários (ex.: `lpLibFileName`), e desalinha o nº de linha do resto do ficheiro.
 */
export async function* readLinesLf(path: string): AsyncGenerator<string> {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
    pending += decoder.write(chunk as Buffer);
    let start = 0;
    for (;;) {
      const nl = pending.indexOf("\n", start);
      if (nl < 0) break;
      const end = nl > start && pending.charCodeAt(nl - 1) === 13 ? nl - 1 : nl;
      yield pending.slice(start, end);
      start = nl + 1;
    }
    pending = pending.slice(start);
  }
  pending += decoder.end();
  if (pending.length) {
    yield pending.charCodeAt(pending.length - 1) === 13 ? pending.slice(0, -1) : pending;
  }
}
