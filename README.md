# SILVOL

A learning platform where **organisations** manage **teachers** and teachers manage **students**.
Built with plain HTML + JavaScript on [Vite](https://vite.dev), styled with Tailwind CSS v4,
and backed by [Supabase](https://supabase.com) (login, database, row-level security).

This is stages 1–6 of the build plan:

| Stage | What | Where |
| --- | --- | --- |
| 1 | Login and sign-up pages (plus forgot / reset password) | `pages/login.html`, `pages/signup.html`, `scripts/auth.js` |
| 2 | Dashboard shell (sidebar, top bar, mobile nav, routing) | `scripts/dashboard/shell.js` |
| 3 | Role protection and redirects | `scripts/lib/auth.js` |
| 4 | Organisation dashboard: list and invite teachers | `scripts/dashboard/org.js` |
| 5 | Teacher dashboard: list and add students | `scripts/dashboard/teacher.js` |
| 6 | Student dashboard: own details + placeholders | `scripts/dashboard/student.js` |

## Set up

You need Node 20+ and a free Supabase account.

1. **Install**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at supabase.com, then open **SQL Editor → New query**, paste the
   whole of `supabase/schema.sql` and run it. This creates the tables, the security rules and the
   trigger that gives each new user their role.
3. **Tell Supabase where the app runs.** *Authentication → URL Configuration*: set **Site URL** to
   `http://localhost:5173` and add `http://localhost:5173/**` under **Redirect URLs**.
   Without this, confirmation and password-reset links point at the wrong place.
4. **(Optional, faster testing)** *Authentication → Sign In / Providers → Email*: switch off
   **Confirm email** so new accounts can log in straight away. Switch it back on for production.
5. **Add your keys.** Copy `.env.example` to `.env` and fill in the Project URL and anon/publishable
   key from *Project Settings → API*.
6. **Run it**
   ```bash
   npm run dev
   ```

Until `.env` is filled in, every page shows a "Supabase isn't configured yet" notice instead of breaking.

## Try the whole flow

1. Open `/pages/signup.html?type=organisation` and register an organisation (this is also the
   "Sign up as an organisation" link on the normal sign-up page). You land on the organisation dashboard.
2. **Teachers** → enter a teacher's email → **Invite teacher**.
3. In a private/incognito window, open `/pages/signup.html` and sign up **with that same email**.
   You land on the teacher dashboard, already part of the organisation.
4. As the teacher, **Students** → invite a student's email, then sign up with it in another window.
   The student dashboard shows their teacher and organisation.
5. Back in the organisation dashboard, the new teacher and student appear.

## How roles work

Roles are decided by the **database**, never by the browser, so a visitor cannot make themselves an
admin by editing the page.

| Person | How they get the role |
| --- | --- |
| Organisation admin | Signs up with `?type=organisation`; the trigger creates the organisation and makes them `org_admin` |
| Teacher | An organisation invites their email; they sign up with that email |
| Student | A teacher invites their email; they sign up with that email |
| Independent learner | Signs up with no invite: a student with no teacher or organisation |

Who can see what is enforced by row-level security in `supabase/schema.sql`:
students see only themselves and their teacher, teachers see only their own students,
organisations see everyone in their organisation. Signed-in users can edit only their own name,
phone, location and about text.

Each role has its own dashboard page. Opening another role's dashboard sends you back to your own;
opening any dashboard while signed out sends you to the login page.

## Good to know

- **Invitations don't send an email.** An invite reserves the address for a role. The success message
  gives you the sign-up link to share. To send real invite emails later, add a Supabase Edge Function
  that calls `auth.admin.inviteUserByEmail`.
- **Someone who already has an account can't be invited** (the invite form says so). Moving existing
  users between teachers or organisations isn't built yet.
- **Google / Microsoft / Apple buttons** work once you enable the provider in *Authentication →
  Providers*. Until then they show a "isn't enabled" message.
- **"Remember me"**: ticked keeps you signed in; unticked signs you out when the tab closes.
- The **My Learning**, **Sessions** and "Recommended" sections of the student dashboard are placeholders.

## Project layout

```
index.html                  landing page
pages/                      login, sign-up, password reset, one dashboard page per role
styles/styles.css           Tailwind theme + all component classes
scripts/auth.js             behaviour for the login / sign-up / password pages
scripts/lib/                supabase client, auth guards, shared UI helpers
scripts/dashboard/          shell, invites, profile, and the org / teacher / student dashboards
supabase/schema.sql         tables, security rules, new-user trigger
vite.config.js              Tailwind plugin + the list of pages to build
```

Adding a page: create the HTML file, then add it to `build.rollupOptions.input` in `vite.config.js`.
(`npm run dev` serves any page automatically; `npm run build` only includes the listed ones.)

## Build and deploy

```bash
npm run build      # outputs to dist/
npm run preview    # try the production build locally
```

Host the `dist/` folder on any static host (Netlify, Vercel, Cloudflare Pages…). Add the deployed
address to **Site URL** / **Redirect URLs** in Supabase, and set the two `VITE_` variables in the host's
environment settings.
