# Auckland Weekend Planner - Next Gen Architecture (V2)

## 1. 核心架构升级 (Core Architecture Upgrade)
- **Vercel** 负责前端托管与 CDN 边缘加速。
- **AWS API Gateway + Lambda** 作为后端 API 层。
- **DynamoDB** 作为核心数据库。

## 2. 破局 Eventfinda 1 Req/s 限制：主动预热模式
- **架构变更**：将原有的“用户请求 -> 触发查库 -> 查不到则请求 API”的被动模式，全面重构为“后台 Cron Job 定时爬取预热”的主动模式。
- **AWS EventBridge (Cron Job)**：
  - 定时触发 Lambda 任务（如：每天凌晨 2 点、早上 8 点、下午 2 点）。
  - 该 Lambda 专门负责按页（分页机制）缓慢拉取 Eventfinda 数据，以完全符合其 1 requests/second 的限制（甚至可以在代码中加上 `await sleep(1500)` 来绝对保证不超限）。
- **DynamoDB 数据落盘**：
  - 拉取到的数据清洗后，全量存入 DynamoDB。
  - 用户端发起请求时，**仅从 DynamoDB 极其快速地读取**，彻底与 3rd party API 的速率限制脱钩。

## 3. DynamoDB 极致性能设计 (Single-Table / PK-SK Design)
采用单表设计（Single-Table Design）以实现纳秒级查询：
- **PK (Partition Key)**: 例如 `REGION#AUCKLAND`
- **SK (Sort Key)**:
  - 天气数据: `WEATHER#YYYY-MM-DD`
  - 活动数据: `EVENT#DATETIME#UUID`
- **TTL (Time To Live)**: 为所有条目设置过期时间戳，过期自动物理删除，利用 AWS 免费的清理机制，实现 **0 维护成本**。

## 4. 安全性升级：AWS Systems Manager (SSM) Parameter Store
- **痛点**：当前 API Keys 可能散落在环境变量或代码中，存在泄露风险且难以集中轮换。
- **方案**：
  - 将 OpenAI/Bedrock, Eventfinda, OpenWeather 的 Keys 统一存入 **AWS SSM Parameter Store (SecureString)**。
  - Lambda 运行时通过 AWS IAM 权限，动态获取解密后的密钥，或者在部署期间由 CDK 注入，实现真正的企业级密钥管理。

## 5. AI 智能化升级：LLM 流式响应 (Stream Response)
- **目标**：提升周末规划 AI 助手的极速体验。
- **架构**：
  - 弃用传统的同步等待（产生假死感），改为 **Server-Sent Events (SSE) 或 WebSocket 流式输出**。
  - 前端实现打字机效果（Typewriter Effect），在后台整合 Event + Weather 数据并由 LLM 思考的同时，用户能立即看到思考过程。