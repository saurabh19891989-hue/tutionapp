# Handoff — ShikshaGram Home Classes

_Last updated: 5 Nov 2026. Written for **you and the Claude session on your own computer** (with Chrome integration) so the project can be finished in one sitting._

---

## 0. Paste this into Claude on your machine to start

> Read `HANDOFF.md` in this repo and complete the open tasks in section 3, in order. Use Chrome for anything that needs a website login (Supabase dashboard, GitHub settings, DigitalPlat, Brevo). Ask me before you create accounts, accept terms or enter ID details, and show me the Supabase keys before committing them. When everything is done, run the live smoke test in section 4 and tell me the results.

---

## 1. Where things stand

**LIVE (5 Nov 2026): <https://shikshagram.dpdns.org/>** (also <https://saurabh19891989-hue.github.io/tutionapp/>). Repo: <https://github.com/saurabh19891989-hue/tutionapp>, default branch `main`.

| Area | Status |
|---|---|
| Web app (React + Vite + Tailwind, static) | ✅ Done. Production build passes. |
| Database schema, security rules, functions (`supabase/schema.sql`) | ✅ Applied to the cloud project. 9 tables + 2 views, RLS on every table, 19 policies. |
| Supabase **cloud** project | ✅ `shikshagram`, ref `bobkfmggdqqegiobgnlo`, Mumbai, Free plan, org "ShikshaGram" owned by **vivek787r@gmail.com**. (saurabh19891989@gmail.com already had 2 active free projects in the Xircl org, the free limit.) |
| Supabase Auth | ✅ Confirm email ON, 6-digit OTP, ShikshaGram templates for sign-in code + confirm sign-up, Site URL = custom domain, redirects = custom domain, github.io, localhost:5173. Rate limits: 60 emails/h, 45 s between emails per user. |
| SMTP | ✅ Gmail `smtp.gmail.com:587` as vivek787r@gmail.com (app password, 500/day). Codes land in Inbox. |
| Keys wired into the app | ✅ `public/config.js` (URL + `sb_publishable_…` key; no secret key anywhere). Keep-alive reads the same file. |
| Admins | ✅ saurabh19891989@gmail.com, vivek787r@gmail.com (`app_settings.admin_emails`) |
| GitHub Pages | ✅ Deploys from `main` via Actions. Custom domain set (`public/CNAME`), DNS check passed, certificate issued, **Enforce HTTPS** on. github.io redirects to the domain. |
| Domain | ✅ `shikshagram.dpdns.org`: DigitalPlat (Vivek's account, verified via GitHub, renews free within 120 days of 5 Nov 2027) → nameservers `aragorn`/`jessica.ns.cloudflare.com` → Cloudflare Free (vivek787r@gmail.com), records in `docs/dns/shikshagram.dpdns.org.zone`, all **DNS only**. |
| Admin login on the live site | ✅ Email code → teacher panel. |
| Local copy | ✅ `C:\Users\saura\Downloads\Sikshagram` (a git clone, so `git pull` keeps it current) |

### Decisions already made (don't re-ask)
- **Brand:** "ShikshaGram Home Classes" (from the paper register), teacher **Vivek Choudhary**. Light blue/yellow/mint education theme, Nunito font, graduation-cap logo.
- **Admin login:** `saurabh19891989@gmail.com`. Add Vivek's email later in the app under **Settings → Admins** (no code change needed).
- **Login:** a 6-digit email code **or** a password. A device stays signed in while it's used at least once every **15 days** (`SESSION_DAYS` in `public/config.js`). The rest is Supabase's automatic token refresh.
- **Billing model (matches the paper sheet):** students pay **per hour** by default (also per class or monthly). Trial classes are free. **Balance = classes taken (billed or not) − confirmed payments.** Negative means advance credit. Bills/invoices are optional. Monthly-plan students only count once their monthly bill is created.
- **Payments:** UPI QR / deep link to the teacher's UPI ID (no gateway, no fees). The parent taps "I have paid" with the UTR number, and the teacher confirms it on the dashboard.
- **Hosting:** GitHub Pages (repo is public). The app uses a hash router (`/#/billing`) and `base: './'`, so it works on any static host or custom domain without rewrites.

---

## 2. What you need on your machine
- Git, Node 20+, and `gh` (GitHub CLI) logged in as **saurabh19891989-hue** (`gh auth status`)
- Chrome with the Claude extension, signed in to: Google (saurabh19891989@gmail.com), GitHub, and later Supabase/DigitalPlat/Brevo
- Optional: `psql` (to run the SQL file) or the Supabase connector/MCP linked to the **saurabh19891989@gmail.com** Supabase account

---

## 3. Setup tasks: all done except where noted

> Sections 3.1–3.7 are kept as a record of how it was set up. **Still open:** everything in 3.8 (real settings and students), and the parent-side checks in §4.


### 3.1 Get the code locally, including a copy in Downloads
```bash
cd ~/Downloads && git clone https://github.com/saurabh19891989-hue/tutionapp.git ShikshaGram-tuition-app
```
```bash
cd ~/Downloads/ShikshaGram-tuition-app && npm install && npm run build
```
(On Windows, use `%USERPROFILE%\Downloads`.) From now on, every `git pull` keeps the Downloads copy current, which is what you asked for originally.

### 3.2 Tidy the GitHub repo (CLI, about 1 minute)
Rename the default branch to `main` (GitHub moves the default automatically). The deploy workflow already listens to `main`:
```bash
gh api -X POST repos/saurabh19891989-hue/tutionapp/branches/claude%2Fnice-pasteur-vusfzl/rename -f new_name=main
```
```bash
git fetch origin && git checkout main && git branch -u origin/main
```
Then remove the old branch name from `.github/workflows/deploy.yml` (`branches: [main]`) and commit.

Enable GitHub Pages with "GitHub Actions" as the source:
```bash
gh api -X POST repos/saurabh19891989-hue/tutionapp/pages -f build_type=workflow
```
(If that errors, Chrome: repo **Settings → Pages → Source: GitHub Actions**.)
Live URL afterwards: **https://saurabh19891989-hue.github.io/tutionapp/**

### 3.3 Create the Supabase project (Chrome)
1. <https://supabase.com/dashboard>, signed in as **saurabh19891989@gmail.com** (Google login is fine).
2. New organization if needed (free), then **New project**: name `shikshagram`, region **South Asia (Mumbai) ap-south-1**, a strong DB password (save it in your password manager). Free plan.
3. When it's ready, run the schema. Pick one:
   - **SQL Editor → New query**: paste all of `supabase/schema.sql` → **Run**. (It's long; pasting via Chrome works but is slow. Typing it is not practical.)
   - **psql**: Dashboard → **Connect** → copy the *Session pooler* URI, then
     ```bash
     psql "postgresql://postgres.<ref>:<db-password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 -f supabase/schema.sql
     ```
   - **Supabase MCP** (if connected to this account): `apply_migration` with the file's contents.
   The script is safe to re-run. Expect a few "already exists, skipping" notices.
4. Check it: **Advisors → Security** should show no RLS errors. Table Editor should list `app_settings, profiles, students, student_members, classes, slots, invoices, payments, announcements`.

### 3.4 Supabase Auth settings (Chrome, or the Management API below)
| Setting | Where | Value |
|---|---|---|
| Email provider | Authentication → Sign In / Providers → Email | Enabled, **Confirm email ON** (security: see §5) |
| Email OTP length | same page | 6 (the app accepts 6–10) |
| Site URL | Authentication → URL Configuration | `https://saurabh19891989-hue.github.io/tutionapp/` (switch to the custom domain later) |
| Redirect URLs | same page | the Site URL above, `http://localhost:5173/**`, and later the custom domain |
| "Magic Link" template | Authentication → Emails → Templates | body = `supabase/email-templates/magic-link.html`, subject e.g. `Your ShikshaGram sign-in code` |
| "Confirm signup" template | same | body = `supabase/email-templates/confirm-signup.html`, subject e.g. `Confirm your ShikshaGram account` |
| SMTP | Authentication → Emails → SMTP Settings | see 3.5 (**important**: the built-in mailer only sends a few emails per hour) |
| Email rate limit | Authentication → Rate Limits | raise to ~100/hour once SMTP is set |

**Faster alternative (untested here, check field names if it errors):** create a personal access token at <https://supabase.com/dashboard/account/tokens>, then:
```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx PROJECT_REF=xxxxxxxx
jq -n --rawfile ml supabase/email-templates/magic-link.html --rawfile cs supabase/email-templates/confirm-signup.html \
 '{site_url:"https://saurabh19891989-hue.github.io/tutionapp/",
   uri_allow_list:"https://saurabh19891989-hue.github.io/tutionapp/**,http://localhost:5173/**",
   mailer_otp_length:6,
   mailer_subjects_magic_link:"Your ShikshaGram sign-in code", mailer_templates_magic_link_content:$ml,
   mailer_subjects_confirmation:"Confirm your ShikshaGram account", mailer_templates_confirmation_content:$cs}' |
curl -sS -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
 -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @-
```

### 3.5 Free email sending (Brevo, 300 emails/day free)
1. Sign up at <https://www.brevo.com> (free plan) with saurabh19891989@gmail.com.
2. **Senders, Domains & Dedicated IPs → Senders**: add and verify a sender email. Once you have the custom domain (3.7), also authenticate the domain in Brevo (DKIM/DMARC records) so codes don't land in spam.
3. **SMTP & API → SMTP**: generate an SMTP key.
4. In Supabase SMTP settings: host `smtp-relay.brevo.com`, port `587`, username = the Brevo SMTP login shown on that page, password = the SMTP key, sender email = the verified sender, sender name `ShikshaGram Home Classes`.
(Resend is an alternative, but it needs a verified domain before it sends to anyone.)

### 3.6 Wire the keys into the app
Supabase → **Project Settings → API**: copy the **Project URL** and the **anon** (or `sb_publishable_…`) key. **Never** use the `service_role`/secret key in the app.

Option A, repo variables (keeps `config.js` generic; also powers the keep-alive job):
```bash
gh variable set SUPABASE_URL --body "https://<ref>.supabase.co" -R saurabh19891989-hue/tutionapp
```
```bash
gh variable set SUPABASE_ANON_KEY --body "<anon-or-publishable-key>" -R saurabh19891989-hue/tutionapp
```
```bash
gh workflow run deploy.yml -R saurabh19891989-hue/tutionapp --ref main
```
Option B: edit `public/config.js`, then commit and push (needed anyway for Netlify/Cloudflare hosting, and for `npm run dev` locally).

### 3.7 Free domain via DigitalPlat FreeDomain (Chrome, needs you)
1. Go to <https://dash.domain.digitalplat.org/> (FreeDomain by DigitalPlat). Sign up and complete whatever verification they ask for (GitHub login and/or ID). **You** should accept the terms and enter personal details.
2. Register a name, e.g. `shikshagram.us.kg` or `shikshagram.dpdns.org` (the available suffixes may change).
3. DigitalPlat only delegates nameservers. Add the domain to a free **Cloudflare** account (<https://dash.cloudflare.com>, Free plan), then put Cloudflare's two nameservers into DigitalPlat.
4. In Cloudflare DNS (set every record to **DNS only / grey cloud** so GitHub can issue the HTTPS certificate):
   - `A @` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA @` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME www` → `saurabh19891989-hue.github.io`
5. In the repo, create `public/CNAME` containing just the domain (e.g. `shikshagram.us.kg`), then commit and push. Repo **Settings → Pages → Custom domain** = the domain, and tick **Enforce HTTPS** once available (can take up to an hour).
6. Supabase **URL Configuration**: change the Site URL to `https://<domain>/` and add `https://<domain>/**` to Redirect URLs.
7. Optional: authenticate this domain in Brevo (3.5) and send from e.g. `classes@<domain>`.

### 3.8 First real use
1. Open the live site → sign in with `saurabh19891989@gmail.com` (email code). You should land on the **teacher panel**.
2. **Settings**: Vivek's UPI ID and name, phone/WhatsApp, contact email, and **add Vivek's email to Admins**.
3. **Students**: add each student with fee plan, rate and parent email. Confirm the real names and rates with Vivek. The handwritten column headers on the October sheet were hard to read, so don't guess.
4. Optional: backfill October/November in the **Register** from the paper sheet (tap a box, pick hours).
5. **Settings → Invite families → Share** the link on WhatsApp. Parents sign up with the email saved on the student and are linked automatically.

---

## 4. Live smoke test (after 3.2–3.6)

**Result, 5 Nov 2026, on https://shikshagram.dpdns.org with parent login vivek19871987@gmail.com:** all passed.
- Unlinked parent sees the "share your email with the teacher" screen.
- Adding a student with that parent email links the account at once (trigger), and Home shows the student, last class and homework.
- Fees due: ₹1,200 (1.5 h × ₹800).
- Parent books the Fri 5–6 pm slot online; it leaves the open list and appears as Scheduled.
- Pay screen shows the UPI QR, the ID and the payee. "I have paid" ₹500 shows as Awaiting check.
- Teacher confirms the payment; parent sees Received, paid ₹500, balance ₹700.
- Session survives closing the tab.
- RLS from the parent login: can't add students (403), can't make itself a teacher (403), can't confirm its own payment (0 rows), sees only its own student.
- Teacher-side writes in this run (settings, student, slots, confirm) were done in the SQL editor, because Chrome held the parent session.
- Known minor issue: any signed-in user can read `app_settings.admin_emails`.
- Test rows were removed right after the test, leaving 0 students/classes/payments/slots/links. The login vivek19871987@gmail.com (parent) still exists. For future test runs, tag rows `TEST` and remove them with:
  ```sql
  delete from public.slots where note = 'TEST slot';
  delete from public.students where full_name = 'TEST Student (delete me)';  -- cascades classes, payments, links
  ```
- `app_settings.upi_id` is a placeholder (`dummy.replace-later@invalid`): replace it in Settings before sharing with families.

- [ ] Site loads with no "connect the database" screen
- [ ] Admin email-code login works; the email arrives with a 6-digit code (check spam)
- [ ] Settings save; UPI ID shows in a parent's Pay screen as a QR code
- [ ] Add a test student with your second email as parent email → sign up with that email (password) → confirmation code → lands on the parent home with the student linked
- [ ] Teacher opens slots → parent books one → it appears in the teacher's calendar and register
- [ ] Parent "I have paid" → teacher Dashboard → **Received** → parent balance updates
- [ ] Log hours in the Register → Billing balances match (hours × rate)
- [ ] Reload/close the browser → still signed in
- [ ] Delete the test student afterwards (Students → Edit → untick Active, or delete the row in Supabase)

---

## 5. Things to know / risks
- **Keep "Confirm email" ON.** Admin rights come from the email in `app_settings.admin_emails`. If confirmation were off, someone could sign up with an admin email that hasn't registered yet.
- **Public repo:** `schema.sql` and the README screenshots contain saurabh19891989@gmail.com. Make the repo private if that matters (GitHub Pages on a private repo needs a paid plan; Cloudflare Pages/Netlify are free with private repos).
- **Free Supabase projects pause after ~7 days unused.** `.github/workflows/keep-alive.yml` pings twice a week once the repo variables from 3.6 exist.
- **Email limits:** without SMTP, Supabase sends very few emails per hour. Password login is the fallback, and anyone can set a password in **Profile**.
- **Session length:** Supabase refresh tokens don't expire on their own. The 15-day inactivity sign-out is enforced in the app (`src/lib/supabase.js`).
- **Timezone:** times use each device's local time (all users are in India, so this is fine).

---

## 6. How it was tested (to repeat locally)
In the cloud session: Postgres 16, Supabase GoTrue `v2.164.0` and PostgREST `v12.2.3` in Docker behind a small Node proxy, a fake SMTP server to capture codes, and Playwright scripts:
- Teacher signs up by email code → Settings → adds 4 students (per-hour, per-class, monthly, per-hour) → logs register hours incl. a trial → opens slots.
- Parent signs up with password + confirmation code → auto-linked → books a slot (online) → UPI pay screen → "I have paid" → session survives reload. An unlinked user sees the "share your email with the teacher" screen.
- Teacher confirms the payment → creates bills for all → balances, bills, register totals and dashboard all agree (e.g. 4.75 hrs × ₹800 = ₹3,800; trial = ₹0).
- SQL-level checks: parents can't see other students, can't insert students, can't create "confirmed" payments, can't change their account type, can't double-book; monthly bills can't be created twice for the same period.

The simplest way to test locally now is the official Supabase CLI (needs Docker): `npx supabase init && npx supabase start`. Run `supabase/schema.sql` against the local DB (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/schema.sql`), point `public/config.js` at `http://127.0.0.1:54321` with the local anon key, and `npm run dev`. Local emails show up in the Mailpit/Inbucket UI at <http://127.0.0.1:54324>.

---

## 7. Code map
```
public/config.js             Supabase URL/key, brand name, SESSION_DAYS
supabase/schema.sql          Everything server-side (idempotent)
  tables     app_settings · profiles · students · student_members · classes · slots · invoices · payments · announcements
  views      invoice_summary · student_balances (security_invoker, so RLS applies)
  functions  is_admin() · my_student_ids() · class_amount() · book_slot() · request_class() · cancel_class()
             generate_invoice() · link_member() · triggers: handle_new_user (profile + auto-link), handle_student_emails
supabase/email-templates/    Email bodies showing {{ .Token }} (the code) + the link
src/lib/supabase.js          client (PKCE, persisted session) + 15-day inactivity sign-out
src/lib/auth.jsx             session, profile, settings, isAdmin, linked students
src/lib/format.js            money/date helpers, classAmount() (mirrors SQL), balanceDue()
src/components/              Layout (sidebar + phone bottom nav), ui kit, MonthCalendar, ClassModals, PayModal
src/pages/Login.jsx          email code / password, sign in / sign up
src/pages/admin/             Dashboard · Register (paper-sheet grid) · Students · Billing · Notices · Settings
src/pages/member/            Home · Fees
src/pages/                   CalendarPage · ClassesPage · Profile (shared, role-aware)
.github/workflows/           deploy.yml (Pages) · keep-alive.yml
```
Rules of thumb: everything a parent can do that changes data goes through a `security definer` RPC or a narrow RLS insert policy. Admin-only writes use the `*_admin` policies. If you add a table, enable RLS and add policies in `schema.sql` (it drops and recreates all public policies each run).

---

## 8. Ideas for later (not started)
- Automatic reminders: class tomorrow / fees due by email (Supabase Edge Function + cron) or WhatsApp
- Razorpay/UPI-intent with automatic confirmation (needs KYC + a small server function)
- Installable app icon prompt (manifest exists; add a service worker for offline)
- Hindi language toggle
- PDF fee receipts; per-student monthly statement to share on WhatsApp
- Import October 2026 paper data in bulk
