import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getContradefReduceLogsTmpDir, getContradefWorkTmpRoot } from "./contradefPaths";

describe("contradefPaths", () => {
  const prevWork = process.env.CONTRADEF_WORK_TMP;
  const prevReduce = process.env.CONTRADEF_REDUCE_LOGS_TMP;

  afterEach(() => {
    if (prevWork === undefined) delete process.env.CONTRADEF_WORK_TMP;
    else process.env.CONTRADEF_WORK_TMP = prevWork;
    if (prevReduce === undefined) delete process.env.CONTRADEF_REDUCE_LOGS_TMP;
    else process.env.CONTRADEF_REDUCE_LOGS_TMP = prevReduce;
  });

  it("respeita CONTRADEF_WORK_TMP do ambiente", () => {
    process.env.CONTRADEF_WORK_TMP = "D:/custom-analysis-tmp";
    expect(getContradefWorkTmpRoot()).toBe("D:/custom-analysis-tmp");
  });

  it("sem env usa os.tmpdir()/contradef-tmp/analysis (portável, sem F:)", () => {
    delete process.env.CONTRADEF_WORK_TMP;
    expect(getContradefWorkTmpRoot()).toBe(join(tmpdir(), "contradef-tmp", "analysis"));
  });

  it("sem env reduce-logs usa os.tmpdir()/contradef-tmp/reduce-logs", () => {
    delete process.env.CONTRADEF_REDUCE_LOGS_TMP;
    expect(getContradefReduceLogsTmpDir()).toBe(join(tmpdir(), "contradef-tmp", "reduce-logs"));
  });
});
