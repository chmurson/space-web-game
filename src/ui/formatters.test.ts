import { describe, expect, it } from "vitest";
import { formatCompactElapsed, formatSpeed } from "./formatters";

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

describe("formatSpeed", () => {
  it("formats high speeds in km/s", () => {
    expect(formatSpeed(15_000)).toBe("15.00 km/s");
  });

  it("formats speeds at threshold in km/s", () => {
    expect(formatSpeed(10_000)).toBe("10.00 km/s");
  });

  it("formats low speeds in m/s", () => {
    expect(formatSpeed(1_234)).toBe("1.23 km/s");
  });

  it("formats speeds just below threshold in m/s", () => {
    expect(formatSpeed(9_999)).toBe("10.00 km/s");
  });

  it("formats zero speed", () => {
    expect(formatSpeed(0)).toBe("0 m/s");
  });
});
