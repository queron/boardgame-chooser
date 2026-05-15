# Board Game Chooser

A lightweight shared board-game night picker for friends. Create a night, share the URL, let each player add games and preferred table vibes, then get an explainable ranked recommendation.

## Features

- Share-link access with no accounts.
- BoardGameGeek XML API search and metadata import.
- Manual correction for BGG player counts and play time.
- Explainable Algorithm 2.0 scoring with per-player fit, hard avoids, BGG-derived feature vectors, dynamic themes, and post-night feedback.
- Dashboard, join flow, and results page.
- Supabase-ready persistence with a local JSON fallback for development and a Supabase BGG metadata cache in hosted environments.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without Supabase env vars, nights are stored in `.local-data/game-nights.json`.

Run local checks with:

```bash
npm test
npm run lint
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. Re-run it after Algorithm 2.0 updates to create the `bgg_games_cache` table.
3. Add these environment variables to `.env.local` and Vercel:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BGG_APP_TOKEN=your-boardgamegeek-application-token
```

The app uses the service role only in server-side route handlers.

## BGG attribution

Metadata is fetched from BoardGameGeek's XML API. Current BGG policy requires registering an application and sending an `Authorization: Bearer ...` token for XML API requests. BGG content and trademarks belong to their respective owners.
