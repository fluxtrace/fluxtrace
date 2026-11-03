import { describe, expect, it } from "vitest";

import { buildPivotFlow } from "./mappedCatalogSync";
import { buildDeterministicSampleNarrative, noteForApi } from "./traceNarrative";
import type { TraceIndexHit } from "./traceIndexArtifact";

describe("traceNarrative", () => {
  it("explica RtlGetCurrentServiceSessionId em amostra benigna sem inventar MITRE", () => {
    const hits: TraceIndexHit[] = [
      {
        fileName: "contradef.TraceInstructions.cdf",
        logType: "TraceInstructions",
        lineNumber: 12,
        apis: ["RtlGetCurrentServiceSessionId"],
        mapped: [],
        origin: "unknown",
        occurrences: 2,
      },
    ];
    const flow = buildPivotFlow("RtlGetCurrentServiceSessionId", hits);
    const md = buildDeterministicSampleNarrative({
      sampleName: "cotb-benign-f7f26",
      flows: [flow],
      focusApi: "RtlGetCurrentServiceSessionId",
    });
    expect(noteForApi("RtlGetCurrentServiceSessionId")).toMatch(/ntdll/i);
    expect(md).toMatch(/benigna/i);
    expect(md).toContain("RtlGetCurrentServiceSessionId");
    expect(md).toContain("name-only");
    expect(md).not.toMatch(/T1622|T1027/);
    expect(md).toMatch(/não se afirma/i);
  });
});
