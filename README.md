# Plinth — Next.js + Supabase

This is the real, deployable version of your architecture marketplace.
It uses:
- **Next.js** — the app itself (frontend pages)
- **Supabase** — the real database + login system (this is what gives every person a permanent, unique Agent ID)
- **Vercel** — where you'll host it, for free, on your own URL

Follow these steps in order. Don't skip ahead — each one depends on the last.

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign up (free).
2. Click **New Project**. Give it any name, set a database password (save it somewhere), pick a region close to you.
3. Wait ~2 minutes for it to finish setting up.

## Step 2 — Create the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project, copy ALL of it, paste it into the SQL editor.
4. Click **Run**. You should see "Success. No rows returned."
5. Click **Table Editor** in the sidebar — you should now see two tables: `profiles` and `projects`.

## Step 3 — Turn off email confirmation (for easy testing)

By default Supabase makes new users confirm their email before they can log in — annoying while you're testing.

1. Go to **Authentication → Providers → Email**.
2. Turn OFF "Confirm email".
3. Save.

(You can turn this back on later before going fully public.)

## Step 4 — Get your API keys

1. Go to **Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

## Step 5 — Run it on your own computer

You'll need [Node.js](https://nodejs.org) installed first (download the LTS version if you don't have it).

```bash
# 1. Open a terminal in this project folder, then install dependencies:
npm install

# 2. Copy the example env file:
cp .env.local.example .env.local

# 3. Open .env.local in any text editor and paste in your Supabase
#    URL and anon key from Step 4.

# 4. Start the app:
npm run dev
```

Open http://localhost:3000 in your browser. You should see Plinth running for real, with actual sign-up/login.

Try it:
- Click **Sign up**, create an account — check your Supabase **Table Editor → profiles** table, your new row should appear with a unique `agent_code`.
- Click **Post a Project** — check the `projects` table, your new row should be there too.

## Step 6 — Push this project to GitHub

1. Create a new repository on https://github.com (empty, no README).
2. In your terminal, inside this project folder:

```bash
git init
git add .
git commit -m "Initial Plinth setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Step 7 — Deploy to Vercel

1. Go to https://vercel.com and sign up (you can sign up with your GitHub account — easiest).
2. Click **Add New → Project**.
3. Import the GitHub repository you just pushed.
4. Before deploying, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**.

In about a minute, you'll get a real public URL like `plinth-yourname.vercel.app` — a real, working website with real accounts, open to anyone on the internet.

---

## What's built so far

- Real sign-up / login (Supabase Auth)
- Every signed-up person gets a unique, permanent Agent ID automatically
- Real project posting, saved to a real database
- Public feed of all posted projects
- Project detail pages
- Dashboard showing your own posted projects
- Editable profile (skills, availability)

## What's NOT built yet (next milestones)

- Chat / negotiation between agents
- Accepting an offer and creating a "deal"
- The 10% platform fee calculation shown live in chat

We're doing this step by step — tell me once you've got Steps 1–7 working, and we'll build chat + deals next, on this same real backend.
