import { computeTwoWeekendOptions } from "./dateUtils";

describe("dateUtils - computeTwoWeekendOptions", () => {
  // Monday
  test("computes correct weekend options on Monday (e.g. 2026-05-25)", () => {
    const ref = new Date("2026-05-24T20:00:00Z"); // Monday morning 8am NZST
    const options = computeTwoWeekendOptions(ref);
    expect(options.thisWeekend).toHaveLength(2);
    expect(options.thisWeekend[0].date).toBe("2026-05-30");
    expect(options.thisWeekend[0].dayName).toBe("Saturday");
    expect(options.thisWeekend[1].date).toBe("2026-05-31");
    expect(options.thisWeekend[1].dayName).toBe("Sunday");

    expect(options.nextWeekend).toHaveLength(2);
    expect(options.nextWeekend[0].date).toBe("2026-06-06");
    expect(options.nextWeekend[0].dayName).toBe("Saturday");
  });

  // Saturday
  test("computes correct weekend options on Saturday (e.g. 2026-05-30)", () => {
    const ref = new Date("2026-05-29T20:00:00Z"); // Saturday morning 8am NZST
    const options = computeTwoWeekendOptions(ref);
    expect(options.thisWeekend).toHaveLength(2);
    expect(options.thisWeekend[0].label).toContain("Today");
    expect(options.thisWeekend[0].date).toBe("2026-05-30");
    expect(options.thisWeekend[1].label).toContain("Tomorrow");
    expect(options.thisWeekend[1].date).toBe("2026-05-31");

    expect(options.nextWeekend[0].date).toBe("2026-06-06");
  });

  // Sunday
  test("computes correct weekend options on Sunday (e.g. 2026-05-31)", () => {
    const ref = new Date("2026-05-30T20:00:00Z"); // Sunday morning 8am NZST
    const options = computeTwoWeekendOptions(ref);
    expect(options.thisWeekend).toHaveLength(1);
    expect(options.thisWeekend[0].label).toContain("Today");
    expect(options.thisWeekend[0].date).toBe("2026-05-31");
    expect(options.thisWeekend[0].dayName).toBe("Sunday");

    expect(options.nextWeekend[0].date).toBe("2026-06-06");
    expect(options.nextWeekend[1].date).toBe("2026-06-07");
  });
});
