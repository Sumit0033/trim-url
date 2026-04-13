# URL Shortener App

A full-stack URL shortener built with Express, EJS, and SQLite for local use.

## Features

- Create short URLs from secure HTTPS links
- Redirect short links to the original URL
- Track click counts
- Delete saved links from the dashboard
- Reject malformed, local, private-network, and insecure destination URLs

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000`

By default, the SQLite database file is created automatically in your local app data folder on Windows. You can override that by setting `DATABASE_PATH` in `.env`.
