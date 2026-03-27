import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
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

    // 1. S3 Bucket for Frontend Hosting
    const websiteBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. CloudFront Distribution with Origin Access Control
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
        },
        {
          httpStatus: 404,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
        }
      ]
    });

    // 3. Deploy Next.js Export to S3 (Depends on Next.js build output in frontend/out)
    // We will leave this commented out or point it at an empty dir if out/ is not ready. But currently we point to frontend/out.
    // If you haven't built NextJS yet, building CDK might fail because this folder doesn't exist.
    // To be safe, we'll create a dummy out folder in the frontend.
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/out'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // 4. DynamoDB Table for Itinerary Caching
    const cacheTable = new dynamodb.Table(this, 'ItineraryCache', {
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 5. Node.js Lambda Function for the Backend Planner
    const plannerLambda = new lambdaNodejs.NodejsFunction(this, 'PlannerLambda', {
      entry: path.join(__dirname, '../lambda/planner/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CACHE_TABLE_NAME: cacheTable.tableName,
        BEDROCK_REGION: process.env.BEDROCK_REGION || process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
        // Will be populated with Eventfinda API keys from Secrets/Env in reality
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

    // 6. API Gateway (HTTP API)
    const api = new apigatewayv2.HttpApi(this, 'PlannerApi', {
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'], // In production, restrict to CloudFront domain
      },
    });

    // Add Route
    const lambdaIntegration = new HttpLambdaIntegration('PlannerIntegration', plannerLambda);
    api.addRoutes({
      path: '/api/plan',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    // 7. Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url ?? '',
      description: 'API Gateway Endpoint',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.domainName}`,
      description: 'CloudFront Distribution URL',
    });
  }
}

