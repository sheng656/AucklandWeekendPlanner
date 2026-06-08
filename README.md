# Auckland Weekend Planner

Auckland Weekend Planner is a weekend planning app for the Auckland region. It combines aggregated local events, weather-aware planning, and an AI assistant that can modify the itinerary directly on screen.

## What changed recently

- Event cards now include direct Google Maps search links for locations.
- The planner panel auto-collapses preferences once an itinerary is generated or loaded.
- Date parsing and filtering now use consistent slicing logic, which reduces off-by-one issues when matching events to selected days.
- OurAuckland scraping formats dates consistently in the Pacific/Auckland timezone.
- The backend cron schedules were updated and a dedicated /api/v2/events endpoint was added.
- Frontend API URL handling was normalized so requests consistently append the expected route paths.

## Core features

### Event discovery

- Aggregates Auckland community activities from Eventfinda, OurAuckland, and Auckland for Kids.
- Deduplicates overlapping listings across sources.
- Shows source attribution and direct event links.
- Caches imagery for richer cards and faster delivery.

### Real-Time Event Integration

- Eventfinda API: NZ's largest entertainment platform.
- OurAuckland: Auckland Council's official community portal.
- Auckland for Kids: Dedicated family-friendly scraper.
- Intelligent Deduplication: similarity scoring checks names and dates to prevent duplicate listings across multiple platforms.
- High-Fidelity Imagery: automates image caching via S3 and optimized delivery using CloudFront CDN.

### Weekend planning

- Uses a three-column desktop layout with Events, Planner, and Chat.
- Falls back to a tabbed mobile layout for smaller screens.
- Lets you add, swap, or remove events from the timeline.
- Shows weather-aware guidance for the selected weekend.

### AI Copilot Agent

The application features a conversational AI Copilot (Itinerary Assistant) that goes beyond generic advice. It can modify your schedule on-screen in real time via structured commands such as REMOVE, ADD, and SWAP.

### AI assistant

- Supports structured itinerary commands such as ADD, REMOVE, and SWAP.
- Uses a resilient multi-tier LLM fallback chain with request caching and rate limiting.
- Cleans frontend payloads before sending them to reduce request size and token usage.

### Resilient Multi-Tier LLM Fallback Chain

To ensure maximum availability while operating at near $0 serverless model costs, the backend uses a resilient 3-tier LLM fallback chain:

1. Tier 1 (Primary - Free): gemini-2.5-flash-lite via Google AI Studio for speed and zero cost.
2. Tier 2 (Secondary - Free): gemini-2.5-flash via Google AI Studio, triggered automatically on quota, timeout, or schema failures.
3. Tier 3 (Paid Backup - Haiku): global.anthropic.claude-haiku-4-5-20251001-v1:0 via AWS Bedrock ap-southeast-2 as the backup reasoning model.

### Caching, Limits and Security

- SSM Parameter Store keeps model credentials secure at /AucklandPlanner/Config/GEMINI_API_KEY and loads them with warm-Lambda in-memory caching.
- Token-saving conversational memory supports N-turn dialogue awareness while the frontend strips large command arrays and metadata before transmission.
- MD5 request caching hashes the message and preference variables into a CACHE#<hash> key in DynamoDB with a 1-hour TTL.
- Daily rate limiting caps requests at 40 per IP per day using DynamoDB TTL, with IP addresses hashed using SHA-256 for GDPR-friendly storage.

### Operations

- Exposes a hidden metrics dashboard at /metrics-dashboard for internal monitoring.
- Stores credentials in AWS SSM Parameter Store.
- Uses DynamoDB for caching, rate limiting, and operational metrics.

### Hidden Public Analytics Dashboard

Exposes a hidden monitoring page at /metrics-dashboard, accessible directly by URL and unlinked from the standard UI. It displays real-time operational telemetry queried directly from Sydney's DynamoDB METRIC#LOG records:

- Total invocations, average response latencies, and token consumption charts.
- Fallback ratios and model share percentages.
- Detailed fallback incident errors and masked raw transaction logs.

## Tech stack

- Frontend: Next.js 16.2, React 19, Tailwind CSS v4, Framer Motion, Lucide Icons.
- API layer: AWS API Gateway + Lambda on Node.js 22.x.
- AI/LLM: Google AI Studio Gemini plus AWS Bedrock fallback.
- Persistence: DynamoDB with TTL-based cleanup.
- Storage/CDN: Amazon S3 and CloudFront.
- Infrastructure: AWS CDK.

## Repository layout

```text
frontend/        Next.js web application
infrastructure/  AWS CDK stack and Lambda handlers
docs/            Setup and implementation notes
```

## Quick start

### 1. Deploy the infrastructure

```bash
cd infrastructure
npm install
npx cdk deploy --profile YourProfile
```

### 2. Configure the frontend

Create `frontend/.env.local` with the base API Gateway URL:

```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-southeast-2.amazonaws.com
```

If you prefer server-side proxying in deployment, set `API_URL` with the same base URL as well.

### 3. Start the app

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in the browser.

## Related docs

- [Frontend setup](frontend/README.md)
- [Backend implementation notes](docs/AGENT_IMPLEMENTATION.md)
- [SSM setup](docs/SSM_SETUP.md)
- [Testing guide](docs/TESTING_GUIDE.md)

*Built with &#10084;&#65039; for Aucklanders and visitors.*