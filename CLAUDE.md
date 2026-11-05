# ShikshaGram Home Classes — project notes for Claude

Tuition-management web app for teacher Vivek Choudhary (10–15 students, home + online classes). Users: teacher/admin, students, parents.

**Open setup work lives in `HANDOFF.md`. Read it first.**

- Stack: React 18 + Vite 6 + Tailwind v4 (static SPA, HashRouter, `base: './'`) + Supabase (Postgres, Auth, RLS). No backend server.
- `npm run dev` / `npm run build`. Runtime config is in `public/config.js` (Supabase URL + anon key; never the service_role key).
- All server logic is in `supabase/schema.sql`. It's idempotent: re-running drops and recreates every public RLS policy, so keep all policies in that file.
- Admins = emails in `app_settings.admin_emails` (`is_admin()` reads the JWT email). That column is hidden from regular users by a column grant: never `select('*')` from `app_settings`; admins read the list via the `get_admin_emails()` RPC. Families are linked to students via `student_members`, created automatically when a profile email matches `students.parent_email`/`student_email`.
- Money: `class_amount()` in SQL and `classAmount()` in `src/lib/format.js` must stay in sync. Balance = billed + unbilled − confirmed payments (`balanceDue()`).
- Bills (`invoices`): `kind` is classes / monthly / manual / adjustment; a negative amount = discount. `invoice_summary.paid_amount` includes general payments and discounts applied to the oldest bills first (`paid_direct` = only payments against that bill). A class's `fee` stays null unless set by hand (null = from the plan; for monthly plans a set fee = extra charge). Charges for missed/cancelled classes are adjustment bills linked via `classes.invoice_id`.
- Testing the parent side without a parent login: in the SQL editor, `set local role authenticated` + `set_config('request.jwt.claims', '{"sub":"<user id>","email":"…","role":"authenticated"}', true)` runs the real functions and rules as that user.
- UI conventions: utilities `card`, `input`, `label`, `btn-primary|soft|ghost|success|danger`, `btn-sm` (defined with `@utility` in `src/index.css`). Shared pieces live in `src/components/ui.jsx` (Modal, Field, Badge, Stat, Tabs, useAction toast helper).
- Keep it simple and phone-first: most parents use it on mobile; the teacher uses the Register on phone too.
