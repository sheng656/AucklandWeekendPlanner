export type Audience = "Couples" | "Friends" | "Family" | "Solo";
export type Budget = "Free" | "Low" | "Medium" | "High";
export interface SelectedDate {
  date: string;       // ISO "YYYY-MM-DD"
  dayName: string;    // "Saturday" or "Sunday"
  label: string;      // "Sat May 24" (for display)
}
export type Region =
  | "Central Auckland"
  | "East Auckland"
  | "West Auckland"
  | "South Auckland"
  | "North Shore"
  | "Waiheke Island";

export interface Activity {
  title: string;
  time: string;
  cost: string;
  description: string;
  location: string;
  eventId: string | null;
  isEmptyPlaceholder?: boolean;
}

export interface TimeSlot {
  period: string;
  activities: Activity[];
}

export interface DayPlan {
  dayName: string;
  date: string;
  timeSlots: TimeSlot[];
  estimatedTotal: string;
}

export interface Itinerary {
  estimatedTotal: string;
  days: DayPlan[];
}

export interface EventData {
  id: string;
  name: string;
  description: string;
  url: string;
  datetime_start: string;
  datetime_end: string;
  location_summary: string;
  is_free: boolean;
  image_url: string;
  source?: string;
  mapped_region?: string;
}

export interface WeatherCurrent {
  temp: number;
  icon: string;
  description: string;
  humidity: number;
}

export interface WeatherForecast {
  date: string;
  dayName: string;
  temp_min: number;
  temp_max: number;
  icon: string;
  description: string;
  humidity: number;
  windSpeed: number;
  isWeekend: boolean;
}

export interface WeatherData {
  current: WeatherCurrent | null;
  forecast: WeatherForecast[];
}

// Agent Chat Types
export interface AgentCommand {
  type: 'REMOVE' | 'ADD' | 'SWAP';
  dayIdx?: number;
  slotIdx?: number;
  actIdx?: number;
  eventId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  commands?: AgentCommand[];
  provider?: string;
  model?: string;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  commands: AgentCommand[];
  provider: string;
  model: string;
  fallbackCount: number;
}
