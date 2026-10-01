# J2 Dev Planner

Company-wide planning tool for J2. Every project or initiative is a **plan**: an editable flow diagram of
stages, where each stage holds the questions the team needs to answer. Answers sync live between everyone
who has the plan open, and progress is tracked as questions move from Open, to To confirm, to Decided.

First plan loaded: **J2 Automated Sales Outreach** (Sales & Marketing).

## Stack

- React 18 + Vite
- React Flow (`@xyflow/react`) for the diagram canvas
- Supabase for login, database, row-level security and realtime sync
- Vercel for hosting

## Run it locally

```bash
npm install
cp .env.example .env.local   # already filled in if you received .env.local
npm run dev
```

Open http://localhost:5173.

## Logins and access

- The **first person to sign up becomes the admin** automatically. Sign up first.
- Everyone after that lands on a "Waiting for approval" screen. Approve them under **Team**.
- All approved members can view and edit every plan. Admins also manage people and departments.

## Supabase settings to check once

In the Supabase dashboard for project `gtwejdzarmfomrnvmifp`:

1. **Authentication > URL Configuration**: set Site URL to your Vercel URL, and add both
   `http://localhost:5173` and the Vercel URL under Redirect URLs. Confirmation and reset emails use these.
2. **Authentication > Sign In / Providers > Email**: leave "Confirm email" on unless you want instant sign-ups.

## Deploy to Vercel

1. Push this folder to a GitHub repo (see below).
2. In Vercel, import the repo. Framework preset: **Vite**.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (values from `.env.local`).
4. Deploy. Every push to `main` redeploys automatically.

`vercel.json` already rewrites all routes to `index.html` so links like `/plan/<id>` work on refresh.

## Push to GitHub

```bash
git init
git add .
git commit -m "J2 Dev Planner: initial version"
git branch -M main
git remote add origin https://github.com/<your-org>/j2-dev-planner.git
git push -u origin main
```

`.env.local` is git-ignored. The publishable key is safe in the browser (row-level security protects the data),
but keep it out of the repo anyway and set it in Vercel.

## Adding new plans

No code needed. Use **New plan** on the dashboard and either start blank or copy the structure of an
existing plan or template. Inside a plan:

- **Add stage** drops a new stage onto the canvas. Drag stages to arrange them.
- Drag from a stage's right edge to another stage to connect them. Double-click a line to label it.
- Click a stage to open it. Add questions, choose the answer type and who answers, and set each status.
- **Walk through** steps through stages in flow order, ideal for review meetings.
- **Questions for…** highlights only the questions owned by one person, e.g. everything for Jason.
- The **⋯** menu duplicates a plan, saves it as a template, archives or deletes it.

## Project structure

```
src/
  App.jsx               routing and login gate
  lib/                  supabase client, auth, toasts, constants, helpers
  components/           stage node, stage drawer, question editor, modals
  pages/                Login, Pending, Dashboard, PlanView, Admin (Team)
supabase/migrations/    database schema, already applied to the live project
```

## Extending the database

Write a new SQL file in `supabase/migrations/` (e.g. `0003_add_due_dates.sql`) and apply it in the Supabase
SQL editor or through Claude with the Supabase connector. Stage categories are limited by a check constraint
on `plan_nodes.category`; update it together with `CATEGORIES` in `src/lib/constants.js`.
