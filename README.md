# Chatly

A small React + Supabase real-time chat starter. Deploy the frontend as a Render Static Site and use Supabase for authentication, profile lookup, message persistence, and live updates.

## Folder structure

```text
Chatly/
├── public/
├── src/
│   ├── components/
│   │   ├── Auth.jsx
│   │   └── Chat.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── render.yaml
├── vite.config.js
└── supabase/
    └── schema.sql
```

## Setup

1. Create a project at [Supabase](https://supabase.com/).
2. Open Supabase **SQL Editor** and run `supabase/schema.sql`.
3. In Supabase Project Settings → API, copy the project URL and publishable/anon key.
4. Copy `.env.example` to `.env.local` and fill in:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   ```
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. To deploy, push the project to a Git repository and create a Render **Static Site**. Build command: `npm install && npm run build`; publish directory: `dist`. Add the two `VITE_SUPABASE_*` environment variables in Render.

## Important notes

- This is a starter app, not a production-audited messaging platform.
- Supabase's public/anon key is designed to be used in the browser; **never put a service-role key in frontend environment variables**.
- The SQL enables row-level security (RLS). Review policies before adding features.
- User discovery is limited to profiles that have opted in / are listed in the app. For a production app, consider privacy controls, abuse reporting, rate limits, and stronger profile-discovery rules.
- Free plans have quotas and can change; check current provider terms.


## YouTube discovery

Explore can search YouTube videos using the YouTube Data API v3. Create an API key in Google Cloud Console, enable **YouTube Data API v3**, and configure `VITE_YOUTUBE_API_KEY` in `.env.local` for local development and in Render's Static Site environment variables for deployment. The browser app uses this key, so restrict it to the Chatly site referrers and YouTube Data API v3 in Google Cloud. Never use a service-account or other private credential in frontend code.
