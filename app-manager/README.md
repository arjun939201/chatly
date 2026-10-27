# App Manager

Standalone, mobile-first repository engineering workspace. The initial vertical slice includes GitHub OAuth, authorized repository discovery, read-only repository diagnostics, issue/PR inspection, recent commits, workflow status, and a responsive dark dashboard with six action workflows.

## Run locally

1. Use Node.js 20+.
2. Copy `.env.example` to `.env`. Create a GitHub OAuth App with callback URL `http://localhost:3001/auth/github/callback`.
3. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `SESSION_SECRET` of at least 32 characters (generate with `openssl rand -hex 32`).
4. Run `npm install`. Start the API with `npm start` and the frontend with `npm run dev` in separate terminals.
5. For production, run `npm run build`, then `npm start` with `NODE_ENV=production` and `APP_URL` set to the public HTTPS origin. Register that origin's `/auth/github/callback` as the OAuth callback.

## Security and current scope

- OAuth state is validated. The access token is encrypted with AES-256-GCM and integrity-protected in an HttpOnly, SameSite cookie; the frontend never receives it. Use a high-entropy secret and HTTPS in production.
- The OAuth flow requests `read:user repo` so private repositories can be listed. API routes in this initial slice are read-only; no commit, branch, PR creation, deployment, or other mutation endpoint is exposed.
- Cookie-backed sessions are stateless and expire after eight hours. OAuth token revocation and managed server-side session storage are not implemented; use a managed session store and token revocation for a multi-instance production deployment.
- Diagnose uses real GitHub API responses for repository metadata, recent commits, root entries, issues, PRs, and Actions runs. Unavailable records are marked skipped, never passed.
- Optimize, Fix, Improve, and Update currently gather repository diagnostics and show next investigation steps. They do not yet patch files, execute builds/tests in a sandbox, or update dependencies. An isolated runner and approved patch workflow are required for those capabilities.
- No health score is fabricated. Workflow results reflect GitHub's actual run status, not a local build.
- Keep OAuth credentials in server environment variables; never put them in Vite variables or commit `.env`.

## Commands

- `npm test` — session encryption and expiry regression tests.
- `npm run build` — production frontend bundle.
- `npm start` — API server (serves the built frontend in production mode).
