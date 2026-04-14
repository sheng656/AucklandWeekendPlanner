# Auckland Weekend Planner

An AI-powered web app that generates personalized weekend itineraries for Auckland via chat and form inputs.

## Architecture

- **Frontend**: Next.js App deployed on Vercel
- **API**: API Gateway + Lambda (Node.js) on AWS
- **AI**: Amazon Bedrock (Claude 3 Haiku)
- **Cache**: DynamoDB with TTL
- **External Data**: Eventfinda + OpenWeather

## Deployment Guide

### 1. Prerequisites
- Node.js 20+
- AWS CLI configured
- Bedrock model access granted in `ap-southeast-2` (Claude 3 Haiku)
- Eventfinda & OpenWeather API Creds
- Vercel account for Frontend

### 2. Deploy AWS Infrastructure
1. Move to the infrastructure directory:
   ```bash
   cd infrastructure
   npm install
   ```
2. Configure credentials in your terminal:
   ```bash
   export EVENTFINDA_USERNAME="your-username"
   export EVENTFINDA_PASSWORD="your-password"
   export OPENWEATHER_API_KEY="your-api-key"
   ```
3. Deploy the CDK stack:
   ```bash
   npx cdk bootstrap aws://<account-id>/ap-southeast-2
   npx cdk deploy
   ```
4. Note the output `InfrastructureStack.ApiUrl`. You will need this for Vercel.

### 3. Deploy Frontend to Vercel
1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Set the Framework Preset to `Next.js`.
4. Set the Root Directory to `frontend`.
5. Add the Environment Variable `NEXT_PUBLIC_API_URL` using the `ApiUrl` obtained from the AWS deployment.
6. Deploy.

## Local Development

```bash
cd frontend
npm install
npm run dev
```
Make sure you create a `.env.local` with `NEXT_PUBLIC_API_URL` pointing to your AWS API Gateway Endpoint to test locally.
