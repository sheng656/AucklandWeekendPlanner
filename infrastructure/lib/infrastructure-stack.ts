import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Core DynamoDB Table (Single-Table Design: PK & SK)
    const dataTable = new dynamodb.Table(this, 'PlannerData', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',    // Automatic Zero-cost Expiration
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 1.5 Image Cache Bucket & CloudFront Distribution (OAC)
    const imageBucket = new s3.Bucket(this, 'EventImageCache', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(14) }],
    });

    const distribution = new cloudfront.Distribution(this, 'ImageDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(imageBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
    });

    // 1.6 Bedrock Guardrails for content filtering
    const guardrail = new bedrock.CfnGuardrail(this, 'ContentGuardrail', {
      name: 'auckland-planner-guardrail',
      blockedInputMessaging: 'This request has been blocked by our content policy. Please try a different query.',
      blockedOutputsMessaging: 'This response has been blocked by our content policy. Please try again.',
      contentPolicyConfig: {
        filtersConfig: [
          { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'VIOLENCE', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
          { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'INSULTS', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
          { type: 'MISCONDUCT', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
        ],
      },
    });

    // 2. EventBridge Cron Job (Pre-warming lambda)
    const cronLambda = new lambdaNodejs.NodejsFunction(this, 'PreWarmingCron', {
      entry: path.join(__dirname, '../lambda/cron/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(15), // Slow fetching allows longer execution
      environment: {
        TABLE_NAME: dataTable.tableName,
        SSM_PATH: '/AucklandPlanner/Config', // Path to parameters logic
        IMAGE_BUCKET_NAME: imageBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
      }
    });

    // Allow Cron Lambda to access SSM Parameter Store & Write to DB
    dataTable.grantReadWriteData(cronLambda);
    imageBucket.grantWrite(cronLambda);
    cronLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParametersByPath', 'ssm:GetParameter', 'ssm:DescribeParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/AucklandPlanner/Config`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/AucklandPlanner/Config/*`
      ],
    }));

    // Every 24 hours rule
    const rule = new events.Rule(this, 'SchedulePreWarming', {
      schedule: events.Schedule.rate(cdk.Duration.hours(24)),
    });
    rule.addTarget(new targets.LambdaFunction(cronLambda));

    // 3. API Lambda (Reads from DB, Calls Bedrock, Responds to frontend via HTTP)
    const apiLambda = new lambdaNodejs.NodejsFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, '../lambda/api/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: dataTable.tableName,
        SSM_PATH: '/AucklandPlanner/Config',
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
        GUARDRAIL_ID: guardrail.attrGuardrailId,
        GUARDRAIL_VERSION: guardrail.attrVersion,
      }
    });

    // API Access
    dataTable.grantReadData(apiLambda);
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParametersByPath', 'ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/AucklandPlanner/Config/*`],
    }));

    // Bedrock Access (Streaming support requires InvokeModelWithResponseStream)
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream', 'bedrock:ApplyGuardrail'],
      resources: ['*'], // Specify model ARN safely in prod
    }));

    // 4. API Gateway
    const api = new apigatewayv2.HttpApi(this, 'PlannerV2Api', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    const apiIntegration = new HttpLambdaIntegration('ApiIntegration', apiLambda);
    api.addRoutes({
      path: '/api/v2/plan',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: apiIntegration,
    });

    new cdk.CfnOutput(this, 'ApiV2Url', {
      value: api.url ?? '',
      description: 'API Gateway Endpoint V2',
    });

    new cdk.CfnOutput(this, 'GuardrailId', {
      value: guardrail.attrGuardrailId,
      description: 'Bedrock Guardrail ID',
    });
  }
}
