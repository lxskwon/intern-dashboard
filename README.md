# Intern Dashboard

A single, shared dashboard that makes intern assignments, status, and mentorship
relationships visible to everyone — mentors, project leads, and other team members.

Built with **Next.js (App Router) + SQLite (Prisma)**. Login with role-based
access (Admin / Mentor / Intern) and full assignment history.

## Features

- **Roster / directory** of all interns — searchable & filterable by name, status, team, and mentor.
- **Status indicator** per intern: 🟢 Available · 🟡 Partially available · 🔴 Fully assigned · ⚪ Out of office.
- **Current assignments** (title, description, ticket link, timeframe, who assigned it) plus **assignment history**.
- **Mentor mapping** — each intern shows their mentor; mentors get a "My interns" view.
- **Self-service updates** — interns update their own status/assignments; mentors and admins can update on their behalf.
- **Overview dashboard** with at-a-glance counts (total / available / assigned / OOO).
- **Admin roster management** — add/remove people, assign mentors, reset passwords.

## Roles & permissions

| Role | Can do |
|---|---|
| **Admin** | Everything: manage the roster, assign mentors, reset passwords, edit any intern |
| **Mentor** | View everyone; edit status & assignments for their own mentees |
| **Intern** | View everyone; edit their own status & assignments |

## Getting started

```bash
npm install
npm run setup     # prisma generate + create SQLite db (starts empty)
npm run dev       # http://localhost:3000
```

### Signing up

The app is **self-service**: there are no pre-created accounts. Go to `/signup`
and create one.

- Signup requires the shared **access code** in `.env` (`SIGNUP_CODE`, default `welcome2026`).
- The **first** account to sign up automatically becomes the **admin**.
- Everyone after picks **intern** or **mentor** at signup.
- After signing in, use **내 카드 (My card)** to fill in your own details.
  Interns manage their status, assignments, mentor, and dates on their card;
  mentors/admins have a lighter profile.

## Useful scripts

- `npm run dev` — start the dev server
- `npm run db:seed` — reseed demo data
- `npm run db:reset` — wipe the DB and reseed
- `npm run build && npm start` — production build

## Notes / decisions (per the PRD)

- **Auth:** simple email + password with signed session cookies (`jose` JWT). This is
  a lightweight internal tool; `SESSION_SECRET` in `.env` **must** be changed for any
  real deployment, and it should be served over HTTPS.
- **Data store:** SQLite via Prisma (`prisma/schema.prisma`). SQLite has no enums, so
  status/role are validated in `src/lib/constants.ts`.
- **History:** assignments are kept and marked `COMPLETED` rather than deleted, giving a
  per-intern history timeline.
- **Out of scope for v1** (from the PRD): time tracking, performance reviews, payroll,
  Slack/calendar integration, mobile app.
