import { render, screen } from '@testing-library/react';
import EventCard from './EventCard';

// Mock framer-motion to avoid issues with animations in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, whileHover }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));

const mockEvent = {
  id: '1',
  name: 'Test Event',
  description: 'This is a test event description.',
  image_url: 'https://example.com/image.jpg',
  datetime_start: '2026-05-16T10:00:00Z',
  datetime_end: '2026-05-16T15:00:00Z',
  location_summary: 'Test Location',
  is_free: true,
  url: 'https://example.com/event',
  source: 'ourauckland-surface',
};

describe('EventCard', () => {
  test('renders event name and description', () => {
    render(<EventCard event={mockEvent} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('This is a test event description.')).toBeInTheDocument();
  });

  test('renders the correct source label', () => {
    render(<EventCard event={mockEvent} />);
    
    expect(screen.getByText('View on OurAuckland')).toBeInTheDocument();
  });

  test('renders FREE badge when event is free', () => {
    render(<EventCard event={mockEvent} />);
    
    expect(screen.getByText('FREE')).toBeInTheDocument();
  });

  test('links to the correct URL', () => {
    render(<EventCard event={mockEvent} />);
    
    const link = screen.getByRole('link', { name: /view on ourauckland/i });
    expect(link).toHaveAttribute('href', 'https://example.com/event');
  });
});
