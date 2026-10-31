# CampusMarket

A student-to-student marketplace for buying, selling and exchanging used course textbooks and lab equipment.

Built for the Zynvex Solutions Virtual Internship, Batch 5 (Project WEB-01).

## Tech stack

- HTML, CSS and JavaScript (frontend)
- Supabase: PostgreSQL database, authentication and (later) image storage
- Vercel for free hosting

## Progress

| Module | Dates | Status |
|---|---|---|
| Module 1: Setup, database and login | Oct 26 - Nov 01 | Done |
| Module 2: Listings, images and requests | Nov 02 - Nov 08 | Planned |
| Module 3: Search, filters and safety | Nov 09 - Nov 15 | Planned |
| Module 4: Testing, deployment and docs | Nov 16 - Nov 22 | Planned |

## Module 1 (completed)

- Project setup and GitHub repository
- Responsive pages: home, login and register, with a shared stylesheet
- User registration and login with Supabase Auth
- Database with five related tables: profiles, listings, listing_images, requests, reports
- Validation rules in the database (allowed conditions, statuses and reasons)
- Index on course code for fast search later
- Row Level Security: users can change only their own data, and reports are visible only to admins

The full schema and security rules are in [`database/schema.sql`](database/schema.sql).

## Project structure

```
campusmarket/
  index.html
  login.html
  register.html
  css/style.css
  js/supabaseClient.js
  js/register.js
  js/login.js
  database/schema.sql
  images/
```

## Run locally

1. Clone the repository.
2. Open `index.html` in a browser.

The Supabase project URL and anon (public) key are in `js/supabaseClient.js`. The anon key is meant to be public; access is protected by Row Level Security.
