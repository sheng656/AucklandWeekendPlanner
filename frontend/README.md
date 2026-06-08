# Auckland Weekend Planner Frontend

This directory contains the Next.js application used for itinerary input and result rendering.

## Completed Features

- Preference selection UI for:
	- Audience: Couples, Friends, Family, Solo
	- Budget: Free, Low, Medium, High
	- Trip day: Saturday, Sunday, Both Days
	- Region: Central Auckland, East Auckland, West Auckland, South Auckland, North Shore, Waiheke Island
- **Multi-Source Event Support**: Dynamic card links and labels for Eventfinda, OurAuckland, and Auckland for Kids.
- **Location Maps Links**: Event cards open Google Maps searches for venue locations directly from the timeline.
- **Attribution Footer**: Dedicated section linking to all event data providers.
- **Weather-Aware Planning**: Real-time forecast integration providing weekend hints in the preference panel.
- **Auto-Collapsing Planner**: The preferences panel collapses automatically once an itinerary is loaded or created.
- **Date Filtering Consistency**: Event matching uses consistent date slicing so selected days and scraped events stay aligned.
- API call flow to backend with selected preferences.
- Loading state and itinerary regeneration support.
- Structured timeline rendering with image-rich event cards.
- Responsive, animated visual design using Tailwind + Framer Motion.
- Basic fallback itinerary when API call fails.

## Planned Features

- True token-level streaming output in the UI.
- Rich map view with activity pins and route suggestions.
- Saved plans and history.
- Share/export (PDF or public link).
- Improved accessibility and keyboard navigation.

## Environment Variables

Create `frontend/.env.local` if you want to bypass the Next.js API proxy during development (otherwise, it will default to proxying to `API_URL`):

```env
NEXT_PUBLIC_API_URL=https://<your-api-id>.execute-api.ap-southeast-2.amazonaws.com
```

Important: The value should be the base API gateway URL (without any trailing path like `/api/v2/plan`), because the client hooks and components append their specific endpoints (e.g., `/api/v2/events`, `/api/v2/plan`, `/api/v2/agent`) automatically.

Recent updates also normalized this URL handling so the frontend always targets the same base gateway across plan, event, and assistant requests.

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy on Vercel

1. Import the repository into Vercel.
2. Set Root Directory to frontend.
3. Keep the Next.js preset.
4. Add `API_URL` (recommended for server-side proxying to avoid client CORS setup) or `NEXT_PUBLIC_API_URL` (for direct client-side requests) with the base API Gateway URL (e.g., `https://<api-id>.execute-api.ap-southeast-2.amazonaws.com`).
5. Deploy.

## Request Contract Used by Frontend

Request body sent to backend:

```json
{
	"audience": "Friends",
	"budget": "Medium",
	"tripDays": "Both Days",
	"region": "Central Auckland",
	"query": "Generate an Auckland weekend itinerary using these inputs..."
}
```

Expected successful response:

```json
{
	"success": true,
	"itinerary": "...markdown itinerary..."
}
```
