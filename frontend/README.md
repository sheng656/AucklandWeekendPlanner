# Auckland Weekend Planner Frontend

This directory contains the Next.js application used for itinerary input and result rendering.

## Completed Features

- Preference selection UI for:
	- Audience: Couples, Friends, Family, Solo
	- Budget: Free, Low, Medium, High
	- Trip day: Saturday, Sunday, Both Days
	- Region: Central Auckland, East Auckland, West Auckland, South Auckland, North Shore, Waiheke Island
- **Multi-Source Event Support**: Dynamic card links and labels for Eventfinda, OurAuckland, and Auckland for Kids.
- **Attribution Footer**: Dedicated section linking to all event data providers.
- **Weather-Aware Planning**: Real-time forecast integration providing weekend hints in the preference panel.
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

Create frontend/.env.local:

```env
NEXT_PUBLIC_API_URL=https://<your-api-id>.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

Important: The value must include /api/v2/plan, because the frontend calls this URL directly.

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
4. Add NEXT_PUBLIC_API_URL with the full API route path.
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
