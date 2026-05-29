# Auckland Weekend Planner 🚀

Auckland Weekend Planner is a premium, AI-powered travel planning application designed specifically for the Auckland region. It aggregates real-time local event data from multiple sources and leverages a highly resilient, budget-optimized Multi-LLM chain to deliver personalized, interactive, and visually stunning weekend itineraries.

---

## 🤖 Resilient AI Copilot Agent (Interactive Timeline Assistant)

The application features a conversational **AI Copilot (Itinerary Assistant)** that goes beyond generic advice—it possesses deep-timeline interaction capabilities to **modify your schedule on-screen in real-time** via structured commands (`REMOVE`, `ADD`, `SWAP`).

### 🛡️ Resilient Multi-Tier LLM Fallback Chain
To ensure maximum availability while operating at near **$0 serverless model costs**, the backend utilizes a resilient 3-Tier LLM Fallback Chain:
1. **Tier 1 (Primary - Free)**: `gemini-2.5-flash-lite` via Google AI Studio (handles 75%+ of requests for lightning speed and zero cost).
2. **Tier 2 (Secondary - Free)**: `gemini-2.5-flash` via Google AI Studio (triggers automatically on 429 quota exceed, timeouts, or JSON schema failures).
3. **Tier 3 (Paid Backup - Haiku)**: `global.anthropic.claude-haiku-4-5-20251001-v1:0` via AWS Bedrock ap-southeast-2 (acts as a high-reasoning paid backup if the primary tier experiences service degradation).

### ⚡ Caching, Limits & Security
* **SSM Parameter Store**: Model credentials (like the Google AI Studio Key) are securely stored in **AWS SSM Parameter Store** at `/AucklandPlanner/Config/GEMINI_API_KEY` and loaded dynamically with warm-Lambda in-memory caching.
* **Token-Saving Conversational Memory**: Supports N-turn dialogue awareness (maintaining the last 5 rounds). The frontend automatically cleans messages before transmission (stripping massive commands arrays and metadata) to minimize request size and conserve context tokens.
* **MD5 Request Caching**: Hashes the user message and preference variables (`dates`, `budget`, `audience`, `region`, `chatHistory`) using MD5 into a `CACHE#<hash>` key in DynamoDB with a 1-hour TTL, serving duplicate requests instantly.
* **Daily Rate Limiting**: Implements a strict security limit of 40 requests/IP/day using DynamoDB TTL, protecting key limits from depletion. IP addresses are hashed using SHA-256 (`ipHash`) for strict GDPR compliance.

---

## ✨ Core Features

### 📅 Real-Time Event Integration
* **Multi-Source Aggregation**: Scrapes and Aggregates Auckland community activities from:
  * **Eventfinda API**: NZ's largest entertainment platform.
  * **OurAuckland**: Auckland Council's official community portal.
  * **Auckland for Kids**: Dedicated family-friendly scraper.
* **Intelligent Deduplication**: Similarity scoring checks names and dates, preventing duplicate listings across multiple platforms.
* **High-Fidelity Imagery**: Automates image caching via S3 and optimized delivery using CloudFront CDN.

### 🎨 Custom Glassmorphic Modals & Visual Polish
* **Custom Confirm Modal (`ConfirmModal.tsx`)**: Replaced browser standard native `confirm()` alerts with gorgeous, state-driven custom modals using Framer Motion spring overlays.
  * **Clear Chat**: Custom red-gradient Trash modal.
  * **Start Over**: Accidental reset interceptor.
  * **Activity Deletion**: Accidental single-tap trash clicks on mobile are blocked by confirmation checks.
  * **Itinerary Overwriting**: Warns the user when clicking "Plan my weekend" in the preference panel if an itinerary is already active.
* **Header & Icon Refinement**: Removed standard beta badges from the header, and added an absolute-positioned sparkling AI badge onto a pulsing sky-cyan glowing button aura that expands on hover.

### 📊 Hidden Public Analytics Dashboard
Exposes a hidden monitoring page at `/metrics-dashboard` (accessible directly by URL, unlinked from standard UI controls). It displays real-time operational telemetry queried directly from Sydney's DynamoDB (`METRIC#LOG` records):
* Total invocations, average response latencies, and token consumption charts.
* Fallback ratios and model share percentages.
* Lists detailed fallback incident errors and masked raw transaction logs.

---

## 🏗️ Technical Stack

- **Frontend**: Next.js 16+, React 19, Tailwind CSS, Framer Motion, Lucide Icons.
- **API Layer**: AWS API Gateway + Lambda (**Node.js 22.x**).
- **AI/LLM**: Amazon Bedrock (Claude 4.5 Haiku) + Google AI Studio (Gemini 2.5).
- **Data Persistence**: DynamoDB (Single-table design with TTL).
- **Storage/CDN**: Amazon S3 + CloudFront (Image Caching).
- **Infrastructure**: AWS CDK (Infrastructure as Code).

---

## 📂 Repository Layout

```text
frontend/        Next.js web application
infrastructure/  AWS CDK stack & Lambda handlers (Cron & API)
deploy.ps1       One-click deployment helper script
```

---

## 🚀 Quick Start (Local)

### 1. Deploy Infrastructure
```bash
cd infrastructure
npm install
npx cdk deploy --profile YourProfile
```

### 2. Configure Environment
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/
```

### 3. Start Development
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` to start planning!

---

*Built with ❤️ for Aucklanders and visitors.*
