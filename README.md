# Auckland Weekend Planner

Auckland Weekend Planner is an AI-assisted trip planner for Auckland. Users choose their audience, budget, trip day, and target region, then receive a generated itinerary.

## Completed Features

### Product and frontend
- Interactive trip preference selection (audience, budget, trip day, Auckland region).
- Itinerary generation trigger with loading state and regenerate support.
- Markdown itinerary rendering for readable sections and bullet lists.
- Responsive UI with motion effects (Framer Motion) and glass-style cards.
- Graceful fallback response when the backend request fails.

### Backend and infrastructure
- AWS API endpoint at POST /api/v2/plan via API Gateway + Lambda.
- Bedrock integration using Claude 3 Haiku for itinerary generation.
- DynamoDB single-table storage for cached pre-warmed events.
- EventBridge scheduled pre-warming Lambda (runs every 8 hours).
- Eventfinda data ingestion with explicit rate limiting between requests.
- SSM Parameter Store integration for secret/config retrieval.

### Delivery tooling
- Infrastructure as code with AWS CDK (TypeScript).
- Frontend deployment-ready setup for Vercel.
- Deployment helper script in deploy.ps1.

## Planned Features

- True end-to-end streaming to the frontend (SSE or WebSocket) instead of aggregated response payloads.
- OpenWeather data integration in the cron/API flow (parameter exists, logic is not wired yet).
- Map-based itinerary view (Mapbox/MapLibre) with event pins.
- Personalized user profiles, saved plans, and share/export options.
- Stronger production security: restricted CORS, model-scoped Bedrock IAM, auth layer.
- Better observability: CloudWatch dashboards, alarms, and tracing.
- CI pipeline with automated lint, test, and deployment checks.

## Architecture Summary

- Frontend: Next.js (frontend)
- API: API Gateway HTTP API + Lambda (infrastructure/lambda/api/index.ts)
- AI: Amazon Bedrock (anthropic.claude-3-haiku-20240307-v1:0)
- Data cache: DynamoDB with TTL
- Scheduler: EventBridge + cron Lambda (infrastructure/lambda/cron/index.ts)
- Secrets/config: AWS SSM Parameter Store (/AucklandPlanner/Config/*)

## Repository Layout

```text
frontend/        Next.js UI
infrastructure/  AWS CDK stack and Lambda handlers
docs/            Architecture and UI/UX notes
deploy.ps1       Interactive deployment helper script
```

## Quick Start (Local)

### 1. Deploy backend infrastructure

```bash
cd infrastructure
npm install
npm run build
npx cdk deploy
```

### 2. Configure frontend environment

Create frontend/.env.local:

```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

### 3. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

Use the single detailed deployment document:

- DEPLOYMENT_GUIDE.md

It includes prerequisites, AWS setup, SSM parameters, CDK deployment, frontend wiring, validation, troubleshooting, and cleanup.
