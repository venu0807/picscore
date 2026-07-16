# PicScore

AI-powered facial symmetry and aesthetics scoring. Runs face landmark detection entirely in the browser using MediaPipe, with optional score saving for authenticated users.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Face Detection**: MediaPipe FaceLandmarker (tasks-vision)
- **Auth**: Supabase (Google OAuth)
- **Storage**: Supabase Storage
- **Database**: Supabase PostgreSQL (profiles, scores tables)

## Getting Started

```bash
cp .env.example .env.local
# Fill in your Supabase project URL and anon key
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_SITE_URL` | Site URL for callback redirects |

## Project Structure

- `app/` — Next.js App Router pages and API routes
- `components/` — React components (CameraCapture, etc.)
- `lib/` — Shared utilities (Supabase client, geometry/scoring)
- `public/` — Static assets

## Rate Limits

- Anonymous users: 1 score/day (tracked via cookie)
- Free-tier authenticated users: 1 score/day (tracked in DB)
- Pro users: unlimited
