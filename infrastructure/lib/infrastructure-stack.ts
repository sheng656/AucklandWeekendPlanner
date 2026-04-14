import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB Table for Itinerary Caching
    const cacheTable = new dynamodb.Table(this, 'ItineraryCache', {
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. Node.js Lambda Function for the Backend Planner
    const plannerLambda = new lambdaNodejs.NodejsFunction(this, 'PlannerLambda', {
      entry: path.join(__dirname, '../lambda/planner/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CACHE_TABLE_NAME: cacheTable.tableName,
        BEDROCK_REGION: process.env.BEDROCK_REGION || process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
        EVENTFINDA_USERNAME: process.env.EVENTFINDA_USERNAME || '',
        EVENTFINDA_PASSWORD: process.env.EVENTFINDA_PASSWORD || '',
        OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '',
      }
    });

    // Grant DynamoDB access
    cacheTable.grantReadWriteData(plannerLambda);

    // Grant Bedrock access
    plannerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0'],
    }));

    // 3. API Gateway (HTTP API)
    const api = new apigatewayv2.HttpApi(this, 'PlannerApi', {
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'], // In production, restrict to Vercel domain later
      },
    });

    // Add Route
    const lambdaIntegration = new HttpLambdaIntegration('PlannerIntegration', plannerLambda);
    api.addRoutes({
      path: '/api/plan',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    // 4. Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url ?? '',
      description: 'API Gateway Endpoint',
    });
  }
}
