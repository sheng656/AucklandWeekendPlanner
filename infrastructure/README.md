# Auckland Weekend Planner Infrastructure

This directory contains the AWS CDK stack and Lambda handlers for the serverless backend.

## Completed Features

- CDK stack provisioning for:
  - DynamoDB table (PK/SK + TTL)
  - API Gateway HTTP API
  - API Lambda (itinerary generation)
  - Cron Lambda (event pre-warming)
  - EventBridge rules for ingestion run every 48 hours
- Bedrock invocation from API Lambda (Claude 4.5 Haiku).
- Eventfinda ingestion pipeline with page-by-page fetch and throttling delay.
- OurAuckland ingestion pipeline using the Surface API POST endpoint, Cheerio parsing, and detail-page enrichment for location/cost.
- Auckland for Kids ingestion pipeline using a hybrid WP REST + LD+JSON parsing strategy for precise family discovery.
- Shared dedupe logic that lets OurAuckland/Kids override older duplicates while preserving provenance.
- **Source Field Pass-through**: API Handler now includes `source` metadata in responses to enable dynamic frontend attribution.
- SSM Parameter Store access for runtime secrets/config.

## Planned Features

- Wire OpenWeather data into cron and planning prompt.
- Narrow IAM permissions to specific Bedrock model ARNs.
- Restrict CORS allowOrigins for production domains.
- Add structured logging, metrics, and alarms.
- Add integration tests for API and cron handlers.
- Expand dev dry-run coverage for ingest Lambdas if more sources are added.

## Prerequisites

- Node.js 20+
- AWS CLI configured
- Bedrock model access in ap-southeast-2
- Eventfinda credentials

Optional for future-compatible config:
- OpenWeather API key

## Build and Deploy

```bash
cd infrastructure
npm install
npm run build
npx cdk bootstrap aws://<account-id>/ap-southeast-2
npx cdk deploy
```

After deployment, take the CloudFormation output InfrastructureStack.ApiV2Url and append /api/v2/plan for frontend usage.

Example:

```text
https://abc123.execute-api.ap-southeast-2.amazonaws.com/ + api/v2/plan
= https://abc123.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

## Runtime Parameters

Expected SSM path:

- /AucklandPlanner/Config/EVENTFINDA_USERNAME
- /AucklandPlanner/Config/EVENTFINDA_PASSWORD
- /AucklandPlanner/Config/OPENWEATHER_API_KEY (reserved for upcoming weather integration)
- INGEST_DRY_RUN=true can be used in a dev environment to run the ingest path without DynamoDB writes or image uploads.

## Useful Commands

```bash
# Compare infrastructure changes
npx cdk diff

# Tail API logs
aws logs tail /aws/lambda/InfrastructureStack-ApiHandler --follow --region ap-southeast-2

# Tail cron logs
aws logs tail /aws/lambda/InfrastructureStack-PreWarmingCron --follow --region ap-southeast-2

# Tail OurAuckland ingest logs
aws logs tail /aws/lambda/InfrastructureStack-OurAucklandSurfaceIngest --follow --region ap-southeast-2

# Run a dev dry-run locally (no DynamoDB writes or image uploads)
INGEST_DRY_RUN=true npm test -- --runInBand test/dedupe.test.ts

# Destroy all deployed resources
npx cdk destroy
```

## Detailed Deployment Instructions

See DEPLOYMENT_GUIDE.md at repository root.
