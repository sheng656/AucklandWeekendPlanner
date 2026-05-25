import { computeTwoWeekendRanges } from '../lambda/shared/utils';

describe('computeTwoWeekendRanges date calculation', () => {
  // Test Monday reference
  test('returns correct ranges on Monday (e.g. 2026-05-25)', () => {
    // 2026-05-25 is Monday in NZ
    const ref = new Date('2026-05-24T20:00:00Z'); // 2026-05-25T08:00:00 NZST
    const range = computeTwoWeekendRanges(ref);
    expect(range.thisWeekend.saturday).toBe('2026-05-30');
    expect(range.thisWeekend.sunday).toBe('2026-05-31');
    expect(range.nextWeekend.saturday).toBe('2026-06-06');
    expect(range.nextWeekend.sunday).toBe('2026-06-07');
  });

  // Test Saturday reference
  test('returns correct ranges on Saturday (e.g. 2026-05-30)', () => {
    // 2026-05-30 is Saturday in NZ
    const ref = new Date('2026-05-29T20:00:00Z'); // 2026-05-30T08:00:00 NZST
    const range = computeTwoWeekendRanges(ref);
    expect(range.thisWeekend.saturday).toBe('2026-05-30');
    expect(range.thisWeekend.sunday).toBe('2026-05-31');
    expect(range.nextWeekend.saturday).toBe('2026-06-06');
    expect(range.nextWeekend.sunday).toBe('2026-06-07');
  });

  // Test Sunday reference
  test('returns correct ranges on Sunday (e.g. 2026-05-31)', () => {
    // 2026-05-31 is Sunday in NZ
    const ref = new Date('2026-05-30T20:00:00Z'); // 2026-05-31T08:00:00 NZST
    const range = computeTwoWeekendRanges(ref);
    expect(range.thisWeekend.saturday).toBe('2026-05-30'); // Saturday yesterday
    expect(range.thisWeekend.sunday).toBe('2026-05-31');   // Today
    expect(range.nextWeekend.saturday).toBe('2026-06-06');
    expect(range.nextWeekend.sunday).toBe('2026-06-07');
  });
});
