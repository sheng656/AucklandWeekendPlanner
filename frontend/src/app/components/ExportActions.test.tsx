import { buildDateFromParts, generateICS } from './ExportActions';
import type { DayPlan } from '../../types';

describe('ExportActions logic', () => {
  beforeAll(() => {
    // Mock TextEncoder for jsdom
    if (typeof global.TextEncoder === 'undefined') {
      const { TextEncoder, TextDecoder } = require('util');
      global.TextEncoder = TextEncoder;
      global.TextDecoder = TextDecoder;
    }
  });

  describe('buildDateFromParts', () => {
    it('parses keywords correctly', () => {
      const now = new Date();
      const today = buildDateFromParts('today', '9:00 AM');
      expect(today.getFullYear()).toBe(now.getFullYear());
      expect(today.getDate()).toBe(now.getDate());
      expect(today.getHours()).toBe(9);
      expect(today.getMinutes()).toBe(0);

      const tomorrow = buildDateFromParts('tomorrow', '2:30 PM');
      const expectedTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      expect(tomorrow.getDate()).toBe(expectedTomorrow.getDate());
      expect(tomorrow.getHours()).toBe(14);
      expect(tomorrow.getMinutes()).toBe(30);
    });

    it('parses specific dates correctly', () => {
      const may3 = buildDateFromParts('May 3', '10:15 AM');
      expect(may3.getMonth()).toBe(4); // May is 4
      expect(may3.getDate()).toBe(3);
      expect(may3.getHours()).toBe(10);
      expect(may3.getMinutes()).toBe(15);
    });
  });

  describe('generateICS', () => {
    it('generates a valid ICS string from DayPlan', () => {
      const plan: DayPlan[] = [
        {
          date: 'May 18',
          dayName: 'Saturday',
          timeSlots: [
            {
              period: 'Morning',
              activities: [
                {
                  title: 'Auckland Zoo',
                  time: '9:00 AM – 11:30 AM',
                  cost: '$20',
                  description: 'Visit the animals',
                  location: 'Western Springs',
                  eventId: '12345'
                }
              ]
            }
          ],
          estimatedTotal: '$20'
        }
      ];

      const ics = generateICS(plan);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Auckland Zoo');
      expect(ics).toContain('UID:12345@aucklandplanner');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });
  });
});
