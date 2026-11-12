# Kitchen Forecast (React + Vite + Supabase + Groq)

Prep smarter. Waste less. Earn more.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase.sql` -> Run. This creates the data table with Row Level Security (each user can only see their own row).
3. Project Settings -> API: copy the Project URL and the anon public key.
4. Authentication -> Providers -> Email: on. (Optional: turn off "Confirm email" while testing.)

## 2. Google login
1. Google Cloud Console -> APIs & Services -> OAuth consent screen (fill in the basics).
2. Credentials -> Create credentials -> OAuth client ID -> Web application.
3. In Supabase: Authentication -> Providers -> Google. Copy the callback URL shown there.
4. Back in Google: add that URL under "Authorised redirect URIs", and your Netlify domain under "Authorised JavaScript origins".
5. Paste the Google client ID and secret into the Supabase Google provider and enable it.
6. Supabase -> Authentication -> URL Configuration: set Site URL to your Netlify domain and add it plus `http://localhost:3000` to Redirect URLs.

## 3. Groq
Create a key at console.groq.com. Set `GROQ_MODEL` to a model ID from console.groq.com/docs/models (pick one that supports Structured Outputs, or the route falls back to plain JSON mode).

## 4. Run locally (optional)
```
npm install
npm run dev        # front end only; the AI button needs the Netlify function
```
To run the AI route too: `npx netlify dev` (put the variables in a `.env` file first).

## 5. Deploy to Netlify
1. Push this folder to GitHub. `package.json`, `index.html` and `netlify.toml` must be at the top level of the repo.
2. Netlify: Add new site -> Import an existing project -> GitHub -> pick the repo. `netlify.toml` already sets the build command (`npm run build`), publish folder (`dist`) and Node 20.
3. Site configuration -> Environment variables: add all six names from `.env.example`. Mark `GROQ_API_KEY` as a secret. The `VITE_` ones are read at build time, so trigger a new deploy after adding them.
4. Put your `*.netlify.app` address into Supabase (Site URL and Redirect URLs) and into Google's Authorised JavaScript origins.
5. The function in `netlify/functions/` is served at `/api/suggest-ingredients`.

## Notes
- `VITE_` variables are visible in the browser; `GROQ_API_KEY` must never have that prefix.
- The AI route checks the Supabase login and has a best-effort 40/day limit per user (in memory, so it resets when the function restarts). Use a database counter for a hard limit.
- Forecasts are estimates, not guaranteed sales.
