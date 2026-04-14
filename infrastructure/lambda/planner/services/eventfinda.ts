export const fetchEvents = async (location: string) => {
  const username = process.env.EVENTFINDA_USERNAME;
  const password = process.env.EVENTFINDA_PASSWORD;
  
  if (!username || !password) {
    console.warn('Eventfinda credentials not set. Skipping event fetch.');
    return [];
  }

  // Eventfinda API requires Basic Auth. Use Buffer.from for Node.js
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    // We only fetch a small subset focusing on Auckland
    // Eventfinda locations: auckland
    const response = await fetch(`https://api.eventfinda.co.nz/v2/events.json?rows=10&location=auckland`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Eventfinda error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: any = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
};
