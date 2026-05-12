import { 
  getSourceLabel, 
  getSourceShortLabel, 
  getSourceHomepage, 
  getSourceColor,
  getSourceHoverColor
} from './sourceUtils';

describe('sourceUtils', () => {
  test('resolves eventfinda correctly', () => {
    expect(getSourceShortLabel('eventfinda')).toBe('Eventfinda');
    expect(getSourceColor('eventfinda')).toBe('text-blue-500');
  });

  test('resolves ourauckland correctly', () => {
    expect(getSourceShortLabel('ourauckland-surface')).toBe('OurAuckland');
    expect(getSourceHomepage('ourauckland-surface')).toContain('ourauckland');
  });

  test('resolves aucklandforkids correctly', () => {
    expect(getSourceLabel('aucklandforkids')).toBe('View on Auckland for Kids');
    expect(getSourceColor('aucklandforkids')).toBe('text-orange-500');
  });

  test('falls back to default for unknown sources', () => {
    expect(getSourceShortLabel('unknown')).toBe('Event');
    expect(getSourceHoverColor('unknown')).toBe('hover:text-blue-700');
  });

  test('falls back to eventfinda for undefined source', () => {
    expect(getSourceShortLabel(undefined)).toBe('Eventfinda');
  });
});
