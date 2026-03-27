export const fetchWeather = async (location: string) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('OpenWeather API key not set. Skipping weather fetch.');
    return null;
  }

  // Use a sensible default bounding box for Auckland coordinates.
  const lat = -36.8485;
  const lon = 174.7633;

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    if (!response.ok) {
      console.error(`OpenWeather error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
};
