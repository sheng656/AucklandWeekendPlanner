# Auckland Weekend Planner Deployment Guide

This is the only deployment guide for this repository.

## 1. Scope

This guide covers:

- AWS infrastructure deployment (CDK stack).
- Runtime parameter setup in SSM.
- Frontend configuration for local development and Vercel.
- End-to-end verification.
- Common troubleshooting and cleanup.

## 2. Current Deployment Architecture

- Frontend: Next.js app in frontend.
- API endpoint: API Gateway HTTP API route POST /api/v2/plan.
- API compute: Lambda function InfrastructureStack-ApiHandler.
- AI model: Bedrock Claude 3 Haiku (anthropic.claude-3-haiku-20240307-v1:0).
- Data cache: DynamoDB table with PK/SK and TTL.
- Pre-warming: EventBridge rule triggers InfrastructureStack-PreWarmingCron every 8 hours.
- Secret/config source: SSM Parameter Store under /AucklandPlanner/Config.

Important behavior note:

- The backend calls Bedrock with streaming API internally.
- The backend currently aggregates the stream and returns one JSON payload to the frontend.
- The frontend does not receive token-by-token stream yet.

## 3. Prerequisites

You need:

- AWS account with permissions for CloudFormation, Lambda, API Gateway, DynamoDB, IAM, EventBridge, SSM, and Bedrock.
- AWS CLI v2 installed.
- Node.js 20+.
- npm.
- Access to Bedrock model Claude 3 Haiku in ap-southeast-2.
- Eventfinda API username/password.

Optional (planned integration, not yet wired in code path):

- OpenWeather API key.

## 4. Step-by-Step Deployment

### Step 1: Configure AWS credentials

PowerShell:

```powershell
aws --version
aws configure
aws sts get-caller-identity
```

Recommended region:

- ap-southeast-2

### Step 2: Request Bedrock model access

In AWS Console:

1. Open Amazon Bedrock.
2. Go to Model access.
3. Request access to Anthropic Claude 3 Haiku.
4. Wait until access is granted.

Validate from CLI:

```powershell
aws bedrock list-foundation-models --region ap-southeast-2
```

### Step 3: Create SSM parameters

Create required parameters under /AucklandPlanner/Config.

PowerShell:

```powershell
aws ssm put-parameter --name "/AucklandPlanner/Config/EVENTFINDA_USERNAME" --value "<eventfinda-username>" --type "String" --overwrite --region ap-southeast-2
aws ssm put-parameter --name "/AucklandPlanner/Config/EVENTFINDA_PASSWORD" --value "<eventfinda-password>" --type "SecureString" --overwrite --region ap-southeast-2
aws ssm put-parameter --name "/AucklandPlanner/Config/OPENWEATHER_API_KEY" --value "<openweather-api-key-or-placeholder>" --type "SecureString" --overwrite --region ap-southeast-2
```

Verify:

```powershell
aws ssm get-parameters-by-path --path "/AucklandPlanner/Config" --with-decryption --region ap-southeast-2
```

### Step 4: Install infrastructure dependencies

```powershell
cd infrastructure
npm install
npm run build
```

Optional pre-check:

```powershell
npx cdk diff
```

### Step 5: Bootstrap and deploy CDK

If this account/region is not bootstrapped yet:

```powershell
npx cdk bootstrap aws://<account-id>/ap-southeast-2
```

Deploy:

```powershell
npx cdk deploy --require-approval=never
```

Expected output includes:

- InfrastructureStack.ApiV2Url

Important:

- InfrastructureStack.ApiV2Url is the API base URL.
- Frontend needs the full route URL ending with /api/v2/plan.

Example:

```text
Base: https://abc123.execute-api.ap-southeast-2.amazonaws.com/
Full: https://abc123.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

### Step 6: Configure frontend environment

Create frontend/.env.local:

```env
NEXT_PUBLIC_API_URL=https://abc123.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

Do not use only the base URL. Include /api/v2/plan.

### Step 7: Run frontend locally

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and generate a plan.

### Step 8: Verify backend behavior

#### Verify API Lambda logs

```powershell
aws logs tail /aws/lambda/InfrastructureStack-ApiHandler --follow --region ap-southeast-2
```

Look for:

- Request parameters logged by handler.
- DynamoDB query success.
- Bedrock invocation success.
- Response length log.

#### Verify cron Lambda logs

```powershell
aws logs tail /aws/lambda/InfrastructureStack-PreWarmingCron --follow --region ap-southeast-2
```

Look for:

- Eventfinda page fetch logs.
- Event count stored to DynamoDB.

#### Optional: invoke cron manually

```powershell
aws lambda invoke --function-name InfrastructureStack-PreWarmingCron --invocation-type RequestResponse --region ap-southeast-2 infrastructure/response.json
Get-Content infrastructure/response.json
```

## 5. Vercel Deployment

1. Import the repository into Vercel.
2. Set root directory to frontend.
3. Add environment variable:

```text
NEXT_PUBLIC_API_URL=https://abc123.execute-api.ap-southeast-2.amazonaws.com/api/v2/plan
```

4. Deploy.

If frontend requests fail in Vercel:

- Confirm environment variable includes /api/v2/plan.
- Confirm API Gateway URL is reachable.
- Check Lambda logs for request activity.

## 6. Troubleshooting

### Problem: AWS CLI command not found

Fix:

- Install AWS CLI v2 and restart terminal.

### Problem: bedrock:InvokeModel access denied

Fix:

- Confirm model access is granted in Bedrock console.
- Confirm IAM user/role can call Bedrock in ap-southeast-2.

### Problem: SSM parameter not found

Fix:

- Re-create parameters under exact path /AucklandPlanner/Config.
- Verify spelling of parameter names.

### Problem: Frontend returns API error status

Fix:

- Confirm NEXT_PUBLIC_API_URL includes /api/v2/plan.
- Confirm stack deployment succeeded.
- Check API Lambda logs.

### Problem: CORS error in browser

Fix:

- Current stack allows all origins. Re-deploy if CORS settings were changed.
- Hard refresh browser and verify endpoint value.

### Problem: Lambda timeout

Fix options:

- Increase API Lambda timeout in infrastructure/lib/infrastructure-stack.ts.
- Reduce prompt size or reduce heavy downstream calls.

## 7. Operations

### Re-deploy after changes

```powershell
cd infrastructure
npm run build
npx cdk deploy --require-approval=never
```

### View stack outputs

```powershell
aws cloudformation describe-stacks --stack-name InfrastructureStack --region ap-southeast-2
```

### Check DynamoDB tables

```powershell
aws dynamodb list-tables --region ap-southeast-2
```

## 8. Production Hardening Checklist

- Restrict CORS allowOrigins to known frontend domains.
- Replace broad Bedrock resource access with model-specific ARN policy.
- Add API authentication/authorization.
- Add CloudWatch alarms for Lambda errors and duration.
- Add dead-letter or retry strategy for cron failures.
- Add CI checks for build/test/lint before deployment.

## 9. Cleanup

Destroy stack resources:

```powershell
cd infrastructure
npx cdk destroy
```

Then remove SSM parameters if no longer needed:

```powershell
aws ssm delete-parameter --name "/AucklandPlanner/Config/EVENTFINDA_USERNAME" --region ap-southeast-2
aws ssm delete-parameter --name "/AucklandPlanner/Config/EVENTFINDA_PASSWORD" --region ap-southeast-2
aws ssm delete-parameter --name "/AucklandPlanner/Config/OPENWEATHER_API_KEY" --region ap-southeast-2
```

## 10. Deployment Helper Script

The repository includes deploy.ps1 for interactive deployment tasks:

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

Script actions:

- check
- params
- deploy
- setup-frontend
- dev
- full
- guide

After using setup-frontend, verify NEXT_PUBLIC_API_URL still includes /api/v2/plan.
