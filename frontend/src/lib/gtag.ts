/**
 * Google Analytics 4 (GA4) Utility
 * Measurement ID: G-0L78LPK5DK
 */

export const GA_MEASUREMENT_ID = "G-0L78LPK5DK";

// Global project identifier for this site
const PROJECT_ID = "weekend_planner";

/**
 * Log a custom event to GA4
 * @param action - Event name
 * @param params - Additional event parameters
 */
export const trackEvent = (action: string, params: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", action, {
      project_id: PROJECT_ID,
      ...params,
    });
  }
};

/**
 * Log itinerary generation
 */
export const trackGenerateItinerary = (region: string) => {
  trackEvent("generate_itinerary", {
    region: region,
  });
};

/**
 * Log event interaction (e.g. swap event)
 */
export const trackEventSwap = (eventName: string) => {
  trackEvent("event_swap", {
    item_name: eventName,
  });
};
