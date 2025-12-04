<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1hf52Av9LzleKvdX0qYYeL-tGgXtjohMn

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Database configuration (SQLite locally, Turso in production)

- By default the API uses a local SQLite database stored at `data/projects.sqlite` (created automatically). Start the API with `npm run server` and seed it with `npm run seed`.
- On Vercel (or any environment with Turso), set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to automatically route all reads/writes to Turso instead of the local file.
- You can still run locally against Turso by exporting the same variables when starting the server: `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run server`.

### Syncing your local data into Turso

When you're ready to merge your local SQLite data into Turso, run:

```
LOCAL_DB_PATH=./data/projects.sqlite \
TURSO_DATABASE_URL=libsql://<your-db>.turso.io \
TURSO_AUTH_TOKEN=<your-token> \
node server/sync-local-to-turso.js
```

The script upserts every local project into Turso, making it safe to re-run without duplicating rows.
