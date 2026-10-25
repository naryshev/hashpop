import { describe, expect, it } from "vitest";
import { advanceMirrorCursor, mirrorLogQuery, normalizeMirrorTimestamp } from "../mirror/cursor";

describe("mirror cursor", () => {
  it("keeps nanoseconds so the same log is excluded by gt:", () => {
    const raw = "1789509263.738657104";
    const cursor = advanceMirrorCursor("0", normalizeMirrorTimestamp(raw));
    expect(cursor).toBe("1789509263.738657104");
    expect(String(parseFloat(raw))).not.toBe(raw);
    expect(mirrorLogQuery(cursor)).toEqual({
      limit: 100,
      timestamp: "gt:1789509263.738657104",
      order: "asc",
    });
  });

  it("moves forward only when a later timestamp arrives", () => {
    const current = "1789509263.738657104";
    expect(advanceMirrorCursor(current, normalizeMirrorTimestamp(current))).toBe(current);
    expect(advanceMirrorCursor(current, normalizeMirrorTimestamp("1789509263.100000000"))).toBe(
      current,
    );
    expect(advanceMirrorCursor(current, normalizeMirrorTimestamp("1789509264.000000000"))).toBe(
      "1789509264.000000000",
    );
  });

  it("requests the newest page when the cursor is still at zero", () => {
    expect(mirrorLogQuery("0")).toEqual({ limit: 100, order: "desc" });
    expect(mirrorLogQuery(0)).toEqual({ limit: 100, order: "desc" });
  });
});
