import { describe, expect, it } from "vitest";
import {
  getBatchByteFootprint,
  resolveDashboardCompletedWallTimes,
  sumWallMsFromInsightSummary,
} from "./analysisWallCalibration";

describe("analysisWallCalibration", () => {
  it("sums measured durations from fileMetrics", () => {
    const sj = {
      fileMetrics: [
        { uploadDurationMs: 1000, processingDurationMs: 500, originalBytes: 100 },
        { uploadDurationMs: 0, processingDurationMs: 200, originalBytes: 50 },
      ],
    };
    expect(sumWallMsFromInsightSummary(sj)).toBe(1700);
    expect(getBatchByteFootprint(sj)).toBe(150);
  });

  it("estimates batches without durations using calibrated ms per byte", () => {
    const anchors = [
      {
        batchId: "anchor",
        sampleName: "a",
        summaryJson: {
          fileMetrics: [
            {
              status: "completed",
              originalBytes: 10_000_000,
              uploadDurationMs: 0,
              processingDurationMs: 10_000_000,
            },
          ],
          metrics: {},
        },
        completedAt: new Date("2024-06-02T12:00:00Z"),
        updatedAt: new Date("2024-06-02T12:00:30Z"),
        createdAt: new Date("2024-06-02T11:58:00Z"),
      },
    ];
    const oldJob = [
      ...anchors,
      {
        batchId: "legacy",
        sampleName: "b",
        summaryJson: {
          fileMetrics: [
            { status: "completed", originalBytes: 1_000_000, uploadDurationMs: 0, processingDurationMs: 0 },
          ],
        },
        completedAt: new Date("2024-06-03T15:00:00Z"),
        updatedAt: new Date("2024-06-03T15:00:05Z"),
        createdAt: new Date("2024-06-03T14:50:00Z"),
      },
    ];
    const r = resolveDashboardCompletedWallTimes(oldJob, { maxReturn: 10 });
    expect(r).toHaveLength(2);
    const legacy = r.find((x) => x.batchId === "legacy")!;
    expect(legacy.wallMsSource).toBe("estimated_size");
    expect(legacy.totalOriginalBytes).toBe(1_000_000);
    expect(legacy.wallMs).toBeGreaterThan(90_000);
    expect(legacy.wallMs).toBeLessThan(1_200_000);
  });

  it("includes every completed row (no filtering by measured wall)", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      batchId: `ctr-wall-${i}`,
      sampleName: `s${i}`,
      summaryJson: {
        fileMetrics: [
          {
            status: "completed",
            originalBytes: 100_000 * (i + 1),
            uploadDurationMs: 0,
            processingDurationMs: 0,
          },
        ],
      },
      completedAt: new Date(2025, 0, i + 2, 18, 0, 0),
      updatedAt: new Date(2025, 0, i + 2, 18, 0, 0),
      createdAt: new Date(2025, 0, i + 1, 9, 0, 0),
    }));
    const r = resolveDashboardCompletedWallTimes(seven, { maxReturn: 20 });
    expect(r.map((x) => x.batchId).sort()).toEqual(["ctr-wall-0", "ctr-wall-1", "ctr-wall-2", "ctr-wall-3", "ctr-wall-4", "ctr-wall-5", "ctr-wall-6"]);
  });
});
