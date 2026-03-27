# Auckland Weekend Planner

An AI-powered serverless web app that generates personalized weekend itineraries for Auckland.

## Architecture

- Frontend: Next.js static export hosted on S3 + CloudFront
- API: API Gateway + Lambda (Node.js)
- AI: Amazon Bedrock (Claude 3 Haiku)
- Cache: DynamoDB with TTL
- External data: Eventfinda + OpenWeather

## Region

This project is configured to deploy to Sydney region by default:

- `ap-southeast-2`

Code defaults already updated:

- CDK stack region defaults to `ap-southeast-2`
- Lambda Bedrock runtime defaults to `ap-southeast-2`

You can still override via environment variables if needed.

## Detailed Deployment Guide (ap-southeast-2)

### 1. Prerequisites

1. Install Node.js 20+
2. Install and configure AWS CLI
3. Ensure Bedrock model access is granted in `ap-southeast-2`
4. Prepare API credentials:
   - Eventfinda username/password
   - OpenWeather API key

### 2. Configure AWS and region (PowerShell)

Run from repository root:

```powershell
aws configure

$env:AWS_REGION="ap-southeast-2"
$env:AWS_DEFAULT_REGION="ap-southeast-2"
$env:CDK_DEFAULT_REGION="ap-southeast-2"
$env:BEDROCK_REGION="ap-southeast-2"
```

### 3. Build frontend once (generate `frontend/out`)

```powershell
cd frontend
npm install
npm run build
```

### 4. Deploy infrastructure (first pass)

```powershell
cd ../infrastructure
npm install

$env:EVENTFINDA_USERNAME="your-eventfinda-username"
$env:EVENTFINDA_PASSWORD="your-eventfinda-password"
$env:OPENWEATHER_API_KEY="your-openweather-api-key"

npx cdk bootstrap aws://$env:CDK_DEFAULT_ACCOUNT/ap-southeast-2
npx cdk deploy
```

After deploy, save these outputs:

- `InfrastructureStack.ApiUrl`
- `InfrastructureStack.CloudFrontUrl`

### 5. Inject API URL into frontend and rebuild

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/api/plan
```

Then rebuild frontend:

```powershell
cd ../frontend
npm run build
```

### 6. Deploy infrastructure again (publish updated frontend)

```powershell
cd ../infrastructure
npx cdk deploy
```

### 7. Verify

1. Open `InfrastructureStack.CloudFrontUrl`
2. Generate an itinerary in UI
3. Confirm API calls go to `execute-api.ap-southeast-2.amazonaws.com`
4. Repeat same request to verify cache behavior

## Common Notes

- If Bedrock model is not available in `ap-southeast-2`, set:
  - `$env:BEDROCK_REGION="<supported-region>"`
  - Then re-run `npx cdk deploy`
- If CloudFront still serves older content, create invalidation for `/*`

## Local Development

Frontend local dev:

```powershell
cd frontend
npm run dev
```

Use `NEXT_PUBLIC_API_URL` in `.env.local` to point to your deployed API endpoint.
