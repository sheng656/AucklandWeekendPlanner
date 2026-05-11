# Auckland Weekend Planner 🚀

Auckland Weekend Planner is a premium, AI-powered travel assistant designed specifically for the Auckland region. It blends real-time event data from Eventfinda with the intelligence of state-of-the-art LLMs to create personalized, interactive, and visually stunning weekend itineraries.

## ✨ Core Features

### 🤖 Intelligent Planning
- **Claude 4.5 Haiku Powered**: Uses the latest generation of Anthropic's models on Amazon Bedrock for lightning-fast, high-reasoning itinerary generation.
- **Geographical Routing**: Intelligent filtering across 6 Auckland sub-regions (Central, North Shore, West, South, East, and Waiheke Island) using LLM-based spatial reasoning.
- **Smart Constraints**: Tailors plans based on Audience (Couples, Families, Solo, Friends), Budget (Free to High), and specific Trip Days.

### 📅 Real-Time Event Integration
- **Live Event Sync**: Automatically pre-warms its database with the latest events from the **Eventfinda API**.
- **OurAuckland Surface Ingest**: Adds a second Auckland event source using the public Surface API POST endpoint, with Cheerio parsing of event list + detail pages for weekend discovery.
- **High-Fidelity Imagery**: Features an automated S3-based image proxy and CloudFront CDN to deliver optimized, high-speed event cover photos.
- **Intelligent Fallbacks**: Robust image logic ensures every activity has a beautiful visual, even if the source API is missing one.
- **Cost-Efficient Security**: Leverages **AWS SSM Parameter Store** for zero-cost, secure credential management instead of expensive Secrets Manager alternatives.

### 🗺️ Interactive Timeline Experience
- **Dynamic Controls**: Remove activities you don't like or "Swap" them for curated alternatives in the same time slot.
- **Slot Management**: Deleted items become interactive placeholders, allowing you to manually add events from a curated "Explore More" pool.
- **Responsive Design**: A premium glassmorphism UI that adapts perfectly:
  - **Desktop**: Optimized side-by-side (Left Image / Right Text) list view.
  - **Mobile**: High-impact vertical card view for on-the-go planning.

### 🛡️ Safety & Reliability
- **Content Safety**: High-performance code-level keyword filtering and pre-filtering logic ensure family-friendly content without additional LLM invocation costs.
- **Weather Awareness**: Real-time forecast integration via **OpenWeather API**, providing helpful hints and emoji-based weather status.
- **Rate-Limit Optimized**: Background data pipeline uses sequential, back-off-ready logic to respect API provider limits.

## 🏗️ Technical Stack

- **Frontend**: Next.js 14+, Tailwind CSS, Framer Motion, Lucide Icons.
- **API Layer**: AWS API Gateway + Lambda (**Node.js 22.x**).
- **AI/LLM**: Amazon Bedrock (Claude 4.5 Haiku).
- **Data Persistence**: DynamoDB (Single-table design with TTL).
- **Storage/CDN**: Amazon S3 + CloudFront (Image Caching).
- **Infrastructure**: AWS CDK (Infrastructure as Code).

### 🧪 Dev Validation
- **Dry-run Mode**: Both ingest Lambdas support `INGEST_DRY_RUN=true`, which runs list/detail parsing and dedupe simulation without writing to DynamoDB or uploading images.
- **48-hour Cadence**: Eventfinda and OurAuckland ingest jobs are scheduled every 48 hours to reduce load and keep free-tier usage low.

## 📂 Repository Layout

```text
frontend/        Next.js web application
infrastructure/  AWS CDK stack & Lambda handlers (Cron & API)
docs/            Architecture design and UI/UX documentation
deploy.ps1       One-click deployment helper script
```

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
OPENWEATHER_API_KEY=your_key
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
