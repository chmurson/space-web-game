import { describe, expect, it } from "vitest";
import { formatCompactElapsed } from "./formatters";

describe("formatCompactElapsed", () => {
  it("shows split day and hour units for long durations", () => {
    expect(formatCompactElapsed(2.5 * 24 * 3600)).toBe("2d12h");
  });

  it("shows split hour and minute units under one day", () => {
    expect(formatCompactElapsed(2.5 * 3600)).toBe("2h30m");
  });

  it("falls back to minutes and seconds for short durations", () => {
    expect(formatCompactElapsed(5 * 60 + 29)).toBe("5m");
    expect(formatCompactElapsed(42)).toBe("42s");
  });
});
