# Auckland Weekend Planner - Frontend

This is a [Next.js](https://nextjs.org) application.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create a `.env.local` file in this directory and reference your AWS API Gateway endpoint:

```env
NEXT_PUBLIC_API_URL=https://<your-api-id>.execute-api.ap-southeast-2.amazonaws.com/api/plan
```

## Deployment on Vercel

This app is designed to be deployed on Vercel:

1. Import your project from GitHub to Vercel.
2. Select the `frontend` folder as the root directory.
3. Keep the Next.js framework preset.
4. Add the `NEXT_PUBLIC_API_URL` environment variable.
5. Deploy.
