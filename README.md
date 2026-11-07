<div align="right"><b>English</b> | <a href="README.zh-CN.md">中文</a></div>

# Habit Cards · 习惯卡

A single-file habit-tracking web app built around the four laws of *Atomic Habits* (cue, craving, response, reward) — with a built-in learning progress console, installable as a PWA, and optional email-based cloud sync. Self-hosts on the free tier of Cloudflare Pages + D1.

**Live demo: https://habit-cards.pages.dev**（UI 语言目前为中文 / UI is currently in Chinese）

## Features

- **Single-file app** — the entire frontend lives in one `index.html` (habit cards + learning progress console + user guide). No framework, no npm frontend dependencies, no external requests.
- **Three-level structure** — cover with three entries (Build / Quit / Progress) → zone list → card detail (four-laws mini-cards + check-in panel + in-place quick check-in animations).
- **Learning progress console** — track goals with a total volume and deadline: completion rate / streak / estimated finish date / weekly review / check-in heatmap.
- **Three theme modes** — light / dark / follow-system, driven by semantic CSS variables across the whole app.
- **PWA** — manifest + Service Worker (HTML network-first, static assets cache-first, `/api/*` never cached). Fully usable offline; installable to a phone home screen.
- **Poster export** — pure Canvas 2D two-pass layout, exports a shareable poster per habit card.
- **Your data, your rules**:
  - Signed out: data lives only in your browser's localStorage.
  - Optional sign-in: register with an email to sync a whole-snapshot to the cloud (survives device changes and cache clears). On conflict, both sides are compared byte-by-byte and you choose which one to keep.
  - Passwords are hashed with PBKDF2-SHA256 via the standard Web Crypto API (100k iterations, per-user salt), compared in constant time; the register endpoint is rate-limited per source; session tokens last 90 days and can be revoked.
  - Sync failures retry silently — never interrupts normal use.

## Deploy to your own Cloudflare (free tier is enough)

```bash
# 0. Copy the config template
cp wrangler.toml.example wrangler.toml

# 1. Create the D1 database, then put the printed database_id into wrangler.toml
npx wrangler d1 create habit-cards-db

# 2. Initialize the three tables (users / sessions / states)
npx wrangler d1 execute habit-cards-db --remote --file schema.sql

# 3. Collect deployment artifacts into dist/
node tools/build.js

# 4. Log in to Cloudflare and deploy (project name is up to you)
npx wrangler login
npx wrangler pages deploy dist --project-name habit-cards
```

Local development (Functions + local D1 simulation included):

```bash
cp wrangler.toml.example wrangler.toml   # local dev doesn't validate database_id; the placeholder works
node tools/build.js
npx wrangler pages dev --port 8790
```

## Repository layout

```
├── index.html            # The whole frontend: habit cards + progress console + guide (single file)
├── functions/api/        # Cloudflare Pages Functions (cloud sync backend)
│   ├── _lib.js           #   JSON responses / randomness / PBKDF2 / constant-time compare / auth / rate limit
│   ├── register.js       #   POST /api/register (auto sign-in, returns a 90-day token)
│   ├── login.js          #   POST /api/login
│   ├── session.js        #   DELETE /api/session (revoke a session)
│   └── state.js          #   GET/PUT /api/state (one snapshot row per user, overwrite-style)
├── schema.sql            # D1 schema: users / sessions / states
├── manifest.json         # PWA manifest
├── sw.js                 # Service Worker
├── icons/                # PWA icons (192/512)
└── tools/
    ├── build.js          # Collects dist/ deployment artifacts
    └── gen-icons.js      # Zero-dependency icon generator (pure Node zlib)
```

## Data & privacy

- The sync snapshot is one row per user, containing only the app's own business keys (habit data / progress data / theme preference) — the backend collects nothing else.
- Sync credentials and sessions live in browser localStorage only; signing out revokes the server-side session.
- When self-hosted, all data lands in your own D1 instance.

## Development notes

- `index.html` is the built single-file artifact: three `<script>` blocks — the cloud-sync module, the learning progress console (a Shadow DOM module), and the main habit-card script.
- After editing, run `node tools/build.js` to refresh `dist/`, then deploy.
- Theming (including dark mode) is driven by the `--c-*` semantic variable layer — new UI should reference semantic variables instead of hard-coded colors.

## License

[MIT](LICENSE)
