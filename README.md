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


## Database migrations and checks

- For a fresh Supabase project, run `supabase/schema.sql` first, then apply every file in `supabase/migrations/` in ascending filename order using the Supabase SQL Editor. For an existing deployment, apply only migrations that have not already been applied.
- Keep the migration files in version control and apply them to staging before production. The frontend build does not execute SQL migrations or verify live Row Level Security policies.
- Run `npm test` for source-level regression checks and `npm run build` for the production bundle. GitHub Actions runs both on pushes and pull requests targeting `main`.
- Only configure public Supabase keys and a referrer-restricted YouTube API key in frontend variables. Never expose a service-role key in a `VITE_*` variable.

## Release verification checklist

Before promoting a deployment, verify these items against the actual Supabase project:

- [ ] Confirm the latest GitHub Actions run has passed both `npm test` and `npm run build`.
- [ ] Confirm the frontend has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured in the target environment.
- [ ] Apply the SQL schema and unapplied migrations in order; verify the required tables and RPCs exist before testing the UI.
- [ ] Verify Row Level Security policies for posts, comments, likes, saves, notifications, direct messages, and group membership using separate test accounts.
- [ ] Test unread/read transitions, live message delivery, and notification updates with two accounts in separate sessions.
- [ ] Check mobile widths and keyboard-only navigation on the deployed site.
- [ ] Never place a Supabase service-role key in browser variables or commit secrets to the repository.

A green build confirms compilation and repository regression checks only; it does not prove that production credentials, database schema, RLS policies, or realtime publication settings are correct.

## Important notes

- This is a starter app, not a production-audited messaging platform.
- Supabase's public/anon key is designed to be used in the browser; **never put a service-role key in frontend environment variables**.
- The SQL enables row-level security (RLS). Review policies before adding features.
- User discovery is limited to profiles that have opted in / are listed in the app. For a production app, consider privacy controls, abuse reporting, rate limits, and stronger profile-discovery rules.
- Free plans have quotas and can change; check current provider terms.


## YouTube discovery

Explore can search YouTube videos using the YouTube Data API v3. Create an API key in Google Cloud Console, enable **YouTube Data API v3**, and configure `VITE_YOUTUBE_API_KEY` in `.env.local` for local development and in Render's Static Site environment variables for deployment. The browser app uses this key, so restrict it to the Chatly site referrers and YouTube Data API v3 in Google Cloud. Never use a service-account or other private credential in frontend code.


## Docker deployment

Chatly can also be built as a production container. The image uses a Node.js build
stage and a small Nginx runtime stage; Supabase remains the managed authentication,
PostgreSQL, storage, and realtime provider.

### Build the image

Pass the public browser configuration as build arguments. These values are embedded
in the frontend bundle by Vite and are **not secrets**. Never pass a Supabase
service-role key or other private credential to this build.

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-public-anon-key \
  --build-arg VITE_YOUTUBE_API_KEY=your-restricted-youtube-api-key \
  -t chatly:local .
```

### Run locally

```bash
docker run --rm -p 8080:80 chatly:local
```

Open http://localhost:8080. The Nginx `/health` endpoint returns `200 ok`.

### Docker notes

- `Dockerfile` builds the Vite production bundle and serves it with Nginx.
- `docker/nginx/default.conf` supports client-side route fallback and static asset caching.
- `.dockerignore` excludes local dependencies, Git history, environment files, and test output.
- Values prefixed with `VITE_` are public browser configuration, not server-side secrets.
- The existing Render Static Site deployment remains unchanged.
- This container does not run Supabase or PostgreSQL; those remain managed services.
