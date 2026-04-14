# Auckland Weekend Planner - Infrastructure

This is an AWS CDK stack utilizing Node.js that sets up the Serverless API and data integrations for our Weekend Planner.

## Features

- **Amazon API Gateway** (HTTP API)
- **AWS Lambda** (Node.js 20) with DynamoDB and Amazon Bedrock integration
- **Amazon DynamoDB** for request caching to reduce Bedrock costs

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build typescript (or let CDK synthesize):
   ```bash
   npm run build
   ```
3. Set your environment variables:
   ```bash
   export EVENTFINDA_USERNAME="your-username"
   export EVENTFINDA_PASSWORD="your-password"
   export OPENWEATHER_API_KEY="your-api-key"
   ```
4. Deploy the stack:
   ```bash
   npx cdk deploy
   ```
5. You should receive a CloudFormation output called `InfrastructureStack.ApiUrl`. Copy this URL for the frontend `.env.local` step.
