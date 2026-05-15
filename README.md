# Auckland Weekend Planner 🚀

Auckland Weekend Planner is a premium, AI-powered travel assistant designed specifically for the Auckland region. It blends real-time event data from Eventfinda with the intelligence of state-of-the-art LLMs to create personalized, interactive, and visually stunning weekend itineraries.

## ✨ Core Features

### 🤖 Intelligent Planning
- **Claude 4.5 Haiku Powered**: Uses the latest generation of Anthropic's models on Amazon Bedrock for lightning-fast, high-reasoning itinerary generation.
- **Geographical Routing**: Intelligent filtering across 6 Auckland sub-regions (Central, North Shore, West, South, East, and Waiheke Island) using LLM-based spatial reasoning.
- **Smart Constraints**: Tailors plans based on Audience (Couples, Families, Solo, Friends), Budget (Free to High), and specific Trip Days.

### 📅 Real-Time Event Integration
- **Multi-Source Aggregation**: Blends events from multiple premium sources for maximum coverage:
  - **Eventfinda API**: Direct integration with NZ's largest event platform.
  - **OurAuckland**: Scrapes Auckland Council's official community event portal.
  - **Auckland for Kids**: Hybrid REST/LD+JSON parsing for dedicated family and kids discovery.
- **Intelligent Deduplication**: Advanced similarity scoring ensures no duplicate entries when an event is listed across multiple platforms.
- **High-Fidelity Imagery**: Features an automated S3-based image proxy and CloudFront CDN to deliver optimized, high-speed event cover photos.
- **Cost-Efficient Security**: Leverages **AWS SSM Parameter Store** for zero-cost, secure credential management instead of expensive Secrets Manager alternatives.

### 🗺️ Interactive Timeline Experience
- **Dynamic Controls**: Remove activities you don't like or "Swap" them for curated alternatives in the same time slot.
- **Slot Management**: Deleted items become interactive placeholders, allowing you to manually add events from a curated "Explore More" pool.
- **Source-Aware Design**: Individual activities link directly back to their original source (Eventfinda, OurAuckland, etc.) with brand-specific styling.
- **Attribution Footer**: Clear transparency with a dedicated footer linking to all data provider homepages.
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

### 🧪 Quality Assurance & Validation
- **Comprehensive Testing**: Full-stack test coverage using **Jest**:
  - **Backend**: Unit tests for scraper logic, JSON-LD extraction, and the hierarchical source prioritization logic.
  - **Frontend**: Component testing for the UI layer and utility tests for brand-source mapping.
- **Dry-run Mode**: Both ingest Lambdas support `INGEST_DRY_RUN=true`, which runs list/detail parsing and dedupe simulation without writing to DynamoDB or uploading images.
- **Reliability Checks**: Integrated `AbortController` timeouts (15s) and rate-limit delays (1500ms) to ensure robust scraping under network variability.

## 📂 Repository Layout

```text
frontend/        Next.js web application
infrastructure/  AWS CDK stack & Lambda handlers (Cron & API)
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

> **Note on CORS & API URLs:**
> When running locally, ensure that your `NEXT_PUBLIC_API_URL` exactly matches the API Gateway endpoint deployed via CDK.
> The backend AWS CDK stack is configured to allow CORS requests from `http://localhost:3000` (for local dev) and `https://weekend.sheng.nz` (for production). If you change the frontend port or domain, you must update the `corsPreflight` settings in `infrastructure-stack.ts` and re-deploy.

### 3. Start Development
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` to start planning!

## 🛣️ Roadmap
- [x] Phase 1: Bug Fixes & Code Cleanup
- [x] Phase 2: User Experience Enhancements
- [x] Phase 3: Dark Mode Optimization
- [x] Phase 4: UI Polish
- [x] Phase 5: Component Refactoring
- [x] Phase 6: Testing & Quality
- [x] Phase 7: Infrastructure Optimization
- [x] Phase 8: Documentation Updates
- [ ] Upcoming: Multi-language support (i18n)
- [ ] Upcoming: Direct calendar sync (Google Calendar / Apple Calendar API integration)

---
*Built with ❤️ for Aucklanders and visitors.*
