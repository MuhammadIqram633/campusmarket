# CampusMarket

A student-to-student marketplace for buying, selling and exchanging used course textbooks, lecture notes and lab equipment.

**Zynvex Solutions Virtual Internship, Batch 5**
**Project:** WEB-01 CampusMarket: Student-to-Student Used Textbook Marketplace
**Intern:** Muhammad Iqram | **Internship ID:** ZYNVEX-CERT-2078 | **Track:** Web Development

**Live site:** https://muhammadiqram633.github.io/campusmarket/

## Problem

Students struggle to find affordable used textbooks and lab equipment, and there is no trusted campus-only place to buy, sell or exchange them. CampusMarket gives students one place to list items, search by course code, and contact each other, with a moderation tool for the student council.

## Tech stack

- **Frontend:** HTML, CSS and JavaScript
- **Backend:** Supabase (PostgreSQL database, authentication and file storage)
- **PDF previews:** pdf.js (runs in the browser)
- **Hosting:** GitHub Pages (free)

## Project plan

| Module | Dates | Focus | Status |
|---|---|---|---|
| Module 1 | Oct 26 - Nov 01 | Setup, database design, authentication | Completed |
| Module 2 | Nov 02 - Nov 08 | Listings, previews, buyer-seller requests | In progress |
| Module 3 | Nov 09 - Nov 15 | Search, filters, safety reporting, polish | Planned |
| Module 4 | Nov 16 - Nov 22 | Testing, deployment, documentation | Planned |

## Module 1: what was completed

1. **Project setup:** project folder with HTML, CSS and JavaScript files, and a GitHub repository with regular commits.
2. **Base user interface:** responsive pages (home, login, register) that share one stylesheet and one navigation bar.
3. **Database design:** five related tables created in Supabase (see below).
4. **Database security:** Row Level Security enabled on every table, with rules that limit what each user can do.
5. **Authentication:** user registration and login using Supabase Auth, with the user profile saved to the database.

### Database design

The database is relational (PostgreSQL). Tables are connected with foreign keys, so data stays consistent.

| Table | Main fields | Purpose |
|---|---|---|
| `profiles` | id, full_name, department, role, created_at | User details linked to the login account. Role is `student` or `admin` |
| `listings` | id, seller_id, title, course_code, category, condition, price, exchange_only, description, status, file_path | Textbooks, notes and lab equipment posted by students |
| `listing_images` | id, listing_id, image_url | Preview images of each listing |
| `requests` | id, listing_id, buyer_id, message, meeting_note, status | Buyer-seller requests (pending, accepted, declined, completed) |
| `reports` | id, listing_id, reporter_id, reason, details, status | Safety reports reviewed by an admin |

Validation rules are enforced by the database itself:

- `condition` can only be `new`, `like_new`, `good` or `fair`.
- `status` values are restricted for listings, requests and reports.
- `price` cannot be negative.
- A buyer can have only one pending request per listing (unique index).
- An index on course code prepares the search feature for Module 3.
- Deleting a user or listing also removes its related data (`on delete cascade`).

The complete SQL is in [`database/schema.sql`](database/schema.sql).

### Security (Row Level Security)

| Table | Rules |
|---|---|
| `profiles` | Everyone can view profiles. A user can create and update only their own profile, and cannot make themselves an admin. |
| `listings` | Everyone can view available listings. A seller can create, edit and delete only their own listings. Hidden listings are visible only to the seller and admins. |
| `listing_images` | Everyone can view. Only the owner of the listing can add or delete images. |
| `requests` | Only the buyer and the seller of the listing can view a request. A buyer cannot send a request on their own listing. Only the seller can update the status. |
| `reports` | Any logged-in user can submit a report. Only admins can view and update reports. |

### Authentication flow

1. **Register:** the user fills in the form. `supabase.auth.signUp()` creates the account, then the user's full name and department are saved in the `profiles` table.
2. **Login:** `supabase.auth.signInWithPassword()` checks the email and password, then the user is redirected to the home page.
3. Errors (for example a wrong password) are shown in a message under the form.

The Supabase project URL and the publishable (anon) key are used in `js/supabaseClient.js`. The publishable key is designed to be public. Data is protected by Row Level Security, and no secret keys are stored in this repository.

## Module 2: listings and previews (in progress)

Completed so far:

- **Sell page:** logged-in users can post a listing (title, course code, category, condition, price or exchange-only, description) with form validation. A visitor who is not logged in is sent to the login page.
- **Live listings:** the home page loads listings from the database and shows them as cards.
- **Automatic PDF previews:** when a seller uploads a PDF, the first 3 pages are converted to images in the browser (pdf.js) and used as the public preview. Photos (JPG, PNG, WebP) can also be uploaded.
- **Private file storage:** the full PDF is saved in a private Supabase Storage bucket. Only the seller, or a buyer whose request was accepted, can read it. This is enforced by storage policies in the database, not only by the interface.
- **Listing detail page:** clicking a card opens a page with the preview pages, description, condition, price and seller details.
- **Navbar login state:** the navigation bar shows Logout when the user is logged in, and Login and Register when logged out.

Still to do in this module:

- Buyer request form and request log
- Seller Accept/Decline, and file download for accepted buyers
- My Listings page (edit, delete, mark as sold)

### How file sharing works (no payment gateway)

The platform does not handle money. A buyer sends a request, and the buyer and seller agree on the payment between themselves. When the seller accepts the request, the buyer gets access to the full file. Physical books are exchanged through a meeting request.

## Project structure

```
campusmarket/
  index.html               home page with live listings
  listing.html             listing detail page
  create-listing.html      sell page
  login.html
  register.html
  css/
    style.css
  js/
    supabaseClient.js      connects the website to Supabase
    auth.js                login check for protected pages
    nav.js                 navigation bar (login state, logout)
    register.js            registration logic
    login.js               login logic
    home.js                loads and shows listings
    listing.js             listing detail page
    create-listing.js      sell form, PDF previews and uploads
  database/
    schema.sql             tables, validation rules, storage and security policies
  images/
  screenshots/             screenshots used in this README
  README.md
```

## Run locally

1. Clone the repository: `git clone https://github.com/MuhammadIqram633/campusmarket.git`
2. Open the folder in VS Code.
3. Start it with the Live Server extension (right-click `index.html`, then "Open with Live Server").

## Screenshots

### Home page
![Home page](screenshots/home-page.png)

### Register page
![Register page](screenshots/register-page.png)

### Login page
![Login page](screenshots/login-page.png)

### Database tables in Supabase
![Supabase tables](screenshots/supabase-tables.png)

### Registered user in Supabase Authentication
![Supabase user](screenshots/supabase-users-profiles.png)

<!-- Module 2 screenshots: remove the comment markers once these files are in the screenshots folder.

### Home page with live listings
![Home listings](screenshots/home-listings.png)

### Listing detail page
![Listing detail](screenshots/listing-detail.png)

### Sell page
![Sell page](screenshots/sell-page.png)

### Storage buckets in Supabase
![Supabase storage](screenshots/supabase-storage.png)

-->