# Moving API Routes from Supabase to Postgres — Guide for Bilal & Fahad

## 1. What you're actually doing

This website's backend code lives in `app/api/`. Each file in there is called
a "route" — it's the code that runs when the website (or the mobile app)
asks the server for something, like "give me the list of events" or "save
this review."

Right now, about 190 of these route files fetch their data using a service
called **Supabase**. We're moving away from Supabase and talking to our
**Postgres database** directly instead. Postgres is the actual database;
Supabase was just a middleman sitting in front of it. We're cutting the
middleman out.

Your job: go through these route files, one at a time, and rewrite the
"talk to Supabase" code to be "talk to Postgres directly" code instead —
**without changing what the route actually gives back**. Nobody using the
website or the app should ever notice this happened. If a route currently
returns `{ "categories": [...] }`, it must still return exactly
`{ "categories": [...] }` after you're done — same field names, same
structure, same error messages, same everything. You're changing the engine
under the hood, not the car.

This is not a race. Do a few routes, get them reviewed, merge them, then do
a few more. Going slowly and correctly is much more valuable than going fast.

---

## 2. Words you'll see a lot

- **API route** — a file under `app/api/.../route.ts`. It has functions
  named `GET`, `POST`, `PATCH`, or `DELETE` — these run when someone visits
  that URL with that type of request.
- **Endpoint** — same idea as "route," just what people call it when talking
  about the URL (e.g. "the `/api/categories` endpoint").
- **Query** — a request you send to the database asking for data, written in
  a language called **SQL**. Example: `SELECT * FROM categories` means "give
  me every row from the categories table."
- **JSON** — the text format almost everything in this project uses to send
  data around. Looks like `{ "name": "Karachi", "id": 5 }`.
- **`request`/`response`** — the request is what comes in (the URL, any data
  the browser sent); the response is what your code sends back.
- **Terminal** — the black/white text window where you type commands (not a
  code editor). On a Mac this is the "Terminal" app, or the terminal panel
  inside VS Code.
- **Commit** — one saved, named snapshot of changes in git. Each route you
  migrate should be its own commit (explained in section 9).
- **`main`** — the one shared branch everyone works on directly for this
  project. There's no separate staging step — pushing to `main` deploys to
  the real, live website automatically within a minute or two.
- **Environment variable** — a secret setting (like a password or database
  address) that lives outside the code, in a file called `.env`. This file
  is never committed to git — it's private per-computer.

---

## 3. One-time setup (do this once, before touching any route)

1. Make sure you have the project code on your laptop and it runs — repo
   access and a working `.env` file (database connection string and other
   secrets) should already be set up. Never share the `.env` file contents
   or put them in a screenshot/commit.
2. Once you have the code:
   ```bash
   npm install
   npm run dev
   ```
   This starts the website on your own laptop at `http://localhost:3000`.
   Leave this running in a terminal tab while you work — you'll use it to
   test every route you migrate.
3. In a **second** terminal tab (leave the first one running `npm run dev`),
   you'll use these commands often:
   ```bash
   npm run typecheck   # checks your code doesn't have type errors
   npm run lint        # checks your code follows style rules
   ```
4. Install a tool called `jq` if you don't have it — it makes reading JSON
   in the terminal much easier. On Mac: `brew install jq`.

You're set up correctly if `npm run dev` starts with no errors and
`http://localhost:3000` loads the website in your browser.

---

## 4. The old way vs. the new way, side by side

**Old way (Supabase) — what you'll find in most files today:**
```ts
import { createServerSupabase } from "@/lib/supabase/server";

const supabase = await createServerSupabase();

const { data, error } = await supabase
  .from("categories")
  .select("id, name, slug")
  .order("name", { ascending: true });
```

**New way (direct Postgres) — what you're converting it to:**
```ts
import { query } from "@/lib/db";

const { rows } = await query(
  `SELECT id, name, slug FROM categories ORDER BY name ASC`,
);
```

Same result, different route to get there. `rows` is a plain JavaScript
array of objects, one per database row — e.g.
`[{ id: 1, name: "Food", slug: "food" }, ...]`. You then send that same
data back in the response exactly like the old code did.

---

## 5. Your toolkit — copy these, don't rewrite them

Everything you need already exists in the codebase. Never write your own
version of these — always import and reuse them.

### 5.1 Running a database query

```ts
import { query } from "@/lib/db";

const { rows } = await query(
  `SELECT * FROM listings WHERE slug = $1`,
  [slug],
);
```

- First argument: the SQL text, with `$1`, `$2`, etc. as placeholders for
  any value that comes from the request (a URL param, a search box, a form
  field — anything a user typed or clicked).
- Second argument: an array of the actual values, in order — `$1` matches
  the first item in the array, `$2` the second, and so on.
- **Never skip the placeholders and paste the value directly into the SQL
  text.** Section 7 explains exactly why, with examples — read it before
  you write your first real query.
- `rows` is your result array. If you expect exactly one row (like fetching
  one listing by its id), just use `rows[0]` — there's no `.single()` like
  Supabase had.

### 5.2 Checking if someone is logged in

Most API routes need to know who's making the request. Use this:

```ts
import { getSession } from "@/lib/auth/session";

const session = await getSession(request); // `request` is the route's NextRequest param
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// session.userId — the logged-in user's id
// session.email  — the logged-in user's email
```

For **pages** (files like `app/something/page.tsx`, not API routes) that
should redirect to `/login` if nobody's signed in:
```ts
import { requireSessionUser } from "@/lib/auth/require-session";

const { user, profile } = await requireSessionUser();
```

For pages that show *different* content when logged in, but shouldn't force
a redirect (e.g. the header showing "Login" vs. your name):
```ts
import { getOptionalSessionUser } from "@/lib/auth/require-session";

const result = await getOptionalSessionUser(); // null if logged out — no redirect happens
```

### 5.3 Checking if someone is an admin/staff member

A lot of routes under `app/api/admin/...` check the logged-in user has an
admin role before doing anything. Use these — don't write your own role
check:

```ts
import { requireAdmin, requireStaff, requireSuperAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";

try {
  const { user, profile } = await requireAdmin(request); // throws if not admin/super_admin
  // ... your route logic ...
} catch (error) {
  const status = getAdminAuthErrorStatus(error); // turns the error into 401 or 403
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unauthorized" },
    { status: status ?? 500 },
  );
}
```

Use `requireStaff` instead if the route says "staff" or "lister" in its old
Supabase role check, and `requireSuperAdmin` if it specifically checked for
`super_admin`.

### 5.4 File uploads (images, PDFs, etc.)

If a route uses `supabase.storage`, replace it with this:

```ts
import { uploadFile, deleteFile, getPublicUrl } from "@/lib/storage/spaces";

const { publicUrl } = await uploadFile(path, buffer, { contentType: "image/jpeg" });
await deleteFile(path);
```

Only touch storage-using routes after you've comfortably migrated several
non-storage routes first — see the ordering in section 10.

---

## 6. The recipe — repeat these exact steps for every route

Do not skip steps or reorder them. This is the same process every time,
which is exactly why it gets easier the more routes you do.

### Step 1 — Pick one route and read it start to finish

Open the file. Before typing anything, answer these questions for yourself
(writing them down as a comment at the top of the file while you work is a
good idea, delete the comment before you finish):

- Does this route require login? Does it require admin/staff?
- What table(s) does it read from or write to?
- Does it filter by anything (a specific id, the logged-in user's id, a
  search term, a status)?
- Does it use `supabase.storage` anywhere?
- **Exactly** what does a successful response look like? Copy the JSON
  shape somewhere so you can compare later.
- **Exactly** what do the error responses look like — what status code,
  what error message shape, for each way this route can fail?

### Step 2 — Test the route as it exists right now, and save the result

With `npm run dev` running, hit the route in a new terminal tab and save
the output:
```bash
curl -s "http://localhost:3000/api/<the-route-path>" | jq . > /tmp/before.json
cat /tmp/before.json
```
If the route needs you to be logged in, log into the site in your browser
first, then copy your session cookie into the curl command — ask a teammate
to show you this once if you're not sure how; after that it's the same every
time. If the route takes a body (POST/PATCH), pass it with `-X POST -H "Content-Type: application/json" -d '{"...": "..."}'`.

Do this for a couple of different cases if the route behaves differently
depending on input — e.g. a valid id and a made-up id that doesn't exist.
Save each as its own file (`before-valid.json`, `before-404.json`, etc.)

**This step matters more than any other step in this whole recipe.** It's
your proof of what "correct" looks like, and it's what step 5 checks against.

### Step 3 — Make sure you're starting from the latest code

```bash
git checkout main
git pull
```
You're working directly on `main` — there's no separate branch. This means
**`main` is what's actually live on the real website** (pushing to `main`
deploys to production automatically, within a minute or two, no one checks
it first). Keep that in mind for Step 5 and Step 8 below — they're not
optional.

### Step 4 — Rewrite the route

1. Replace the Supabase auth check with the matching helper from section
   5.2/5.3.
2. Replace each `supabase.from(...)...` call with a `query(...)` call from
   section 5.1. If the old code joined related tables (something like
   `.select("*, categories(name)")`), you have two options — either write a
   SQL `JOIN`, or run a second `query()` call and combine the results in
   JavaScript yourself. The second option is usually easier to get right as
   a beginner. Look at `resolveCategoryNames` and `attachListingImages` in
   `lib/listings/query-paginated-listings.ts` — both are real examples of
   "run a second query, then stitch the results together" that you can copy
   the shape of.
3. Replace `supabase.storage` calls with section 5.4's functions, if any.
4. Shape your final response to look **exactly** like what you wrote down in
   Step 1 — same field names, same nesting, same key order doesn't matter
   but the structure does.
5. Keep every `try`/`catch` and every error status code the route had
   before. If the old code returned `{ error: "Not found" }` with a 404,
   your new code must too.

Full worked example is in section 8 — copy its structure.

### Step 5 — Test your new code against the saved "before" results

```bash
curl -s "http://localhost:3000/api/<the-route-path>" | jq . > /tmp/after.json
diff /tmp/before.json /tmp/after.json
```
No output from `diff` means they're identical — good. If there's a
difference, that's a bug in your migration — fix it before moving on. Do
this for every case you saved in Step 2 (valid input, not-found, no-login,
wrong-role, etc.)

Then also:
```bash
npm run typecheck
npm run lint
```
Both must pass clean before you move on.

### Step 6 — Check it in the actual browser/app

Don't just trust curl. Open the page in the website (or, if it's a
`mobile/v1` route, tell whoever's testing the mobile app to check their
screen) that actually calls this route, and confirm it still looks and
behaves correctly.

### Step 7 — Remove the old Supabase imports

Once everything above passes, delete the now-unused
`import { createServerSupabase } from "@/lib/supabase/server"` (and any
other now-unused imports) from the file. Run `npm run lint` again — it'll
warn you if you left an unused import behind.

### Step 8 — Run `/code-review` before you push — not after

This is the one step that is not optional, because there's no one else
checking your work before it goes live. Run `/code-review` on your changes
and read what it says. If it flags anything, fix it and run it again until
it comes back clean. For anything in Phase 4 of your track (bulk-delete,
import/rollback) or anything touching payments/auth later, use
`/code-review ultra` instead — it's a deeper check, worth the extra time on
those specifically.

### Step 9 — Commit and push directly to `main`

```bash
git add app/api/<the-route-file>
git commit -m "Migrate <route name> from Supabase to Postgres"
git pull --rebase   # in case the other person pushed something in the meantime
git push
```
One commit per route (or per small tightly-related group from your plan —
see `docs/POSTGRES_MIGRATION_PLAN.md`). **Never combine multiple unrelated
routes into a single commit** — if something needs to be undone later, a
commit that only touches one route/feature is trivial to revert
(`git revert <commit>`); a commit touching five unrelated routes means
undoing all five just to fix one.

If `git push` is rejected (this just means the other person pushed
something first), run `git pull --rebase` then `git push` again — this is
normal and not a problem.

Right after pushing, **check the live site** for the route you just
migrated — it'll be deployed within a minute or two. This is your real
safety net now that there's no staging step in between: catch it within
minutes of pushing, not whenever someone happens to notice later.

---

## 7. SQL safety — read this before writing your first query

This is the single most important section in this document. A mistake here
is not "a bug," it's a real security hole.

**Rule: any value that came from the request — a URL parameter, a search
box, a form field, anything a user typed or clicked — must go into the
`$1`/`$2`/... placeholder array. It must never be pasted directly into the
SQL text.**

```ts
// ✅ Correct — the slug value is passed separately as a parameter
await query(`SELECT * FROM listings WHERE slug = $1`, [slug]);

// ❌ NEVER do this — the value is glued directly into the SQL text
await query(`SELECT * FROM listings WHERE slug = '${slug}'`);
await query("SELECT * FROM listings WHERE slug = '" + slug + "'");
```

Why this matters: if you glue text together like the `❌` examples, someone
could type something like `x' OR '1'='1` into a search box, and instead of
searching for that literal text, it can rewrite what your database query
actually does — read data they shouldn't see, or worse. This is called
**SQL injection** and it's one of the most common ways real websites get
hacked. Using `$1` placeholders makes this completely impossible, because
the database treats whatever's in the array as pure data, never as
instructions — no matter what text is inside it.

This applies **every single time**, even for values you think are "safe" or
already checked elsewhere. There's no downside to always using `$1` — it's
not extra work, it's the same amount of typing. So just always do it.

One thing placeholders *can't* protect, because Postgres doesn't allow it:
column names, table names, and `ASC`/`DESC` in an `ORDER BY`. If a route
lets the user choose how to sort results, never put their raw text into the
SQL. Instead, match their input against a fixed list you write yourself and
only use your own hardcoded text:
```ts
let orderByClause = "ORDER BY created_at DESC"; // default
if (sortParam === "name") orderByClause = "ORDER BY name ASC";
else if (sortParam === "rating") orderByClause = "ORDER BY avg_rating DESC";
// whatever sortParam actually was, it never touches the SQL string directly —
// it only picks which of *our* hardcoded strings gets used.
```
See the `switch (sort)` block in `lib/listings/query-paginated-listings.ts`
for a real example of this exact pattern.

**If you're ever even slightly unsure whether something you wrote is safe,
don't guess and don't just push it — get a second opinion before it ships.**
Ask Claude directly to check the specific query against this rule (paste the
query, ask "does this safely parameterize every user-provided value"), and
run `/code-review` before pushing regardless. This is the one part of this
whole project where "I'll fix it if it breaks" is not good enough — get it
right before it ships, using the tools above, not by asking someone who
also can't read the code.

---

## 8. Every private-data route needs its own explicit filter

Postgres just runs whatever SQL you give it — it has no built-in idea of
"only the owner should see this." So for **any route that touches a
specific user's private data** (bookings, reviews, favorites, business
listings, change requests, profile info, form submissions — anything that
isn't public-for-everyone data like categories or events), your SQL must
explicitly filter to that user, every time:

```sql
SELECT * FROM bookings WHERE id = $1 AND user_id = $2
```
where `$2` is always the logged-in user's id from `getSession` — never
anything the request itself claims about who it belongs to.

This is just a standing rule for every route in this category, not
something you need to investigate case by case — always write the filter,
regardless of what the old Supabase code did or didn't rely on. Skipping it
is the one mistake in this whole guide that won't show up as an error or a
crash — it'll look like it's working perfectly, because testing while
logged in as yourself only ever shows your own data anyway. So this is also
the one thing worth double-checking with a second look (your own, or the
other intern's) before you push: does this specific query filter by the
logged-in user's id, yes or no.

---

## 9. Git workflow (day to day)

There are no branches and no PRs in this workflow — you both work directly
on `main`. That only works safely if you follow these rules exactly:

- Before starting any route, always get the latest code first:
  ```bash
  git checkout main
  git pull
  ```
- **One commit per route** (or per small tightly-related group, like
  `/categories` and `/admin/categories` together — see your track in
  `docs/POSTGRES_MIGRATION_PLAN.md` for which routes count as "one group").
  Never combine multiple unrelated routes into a single commit. This is the
  one rule that matters most in this whole section: if a small, focused
  commit turns out to be wrong, `git revert <that commit>` undoes exactly
  that and nothing else. If five unrelated routes are jammed into one
  commit and one of them is broken, undoing it undoes all five.
- Commit messages should say exactly what you migrated:
  `git commit -m "Migrate /api/categories from Supabase to Postgres"`
- Always run `git pull --rebase` right before you push, in case the other
  person pushed something in the meantime. If `git push` gets rejected,
  that's why — just `git pull --rebase` then `git push` again.
- Run `/code-review` (Step 8 above) **before** every push — this is your
  only check before the change is live, since nobody reviews it after.
- You and the other person should never be mid-way through editing the same
  file at the same time — check your tracks in
  `docs/POSTGRES_MIGRATION_PLAN.md` (you own separate folders, so this
  should naturally never happen) and if it ever does, talk to each other
  first.

---

## 10. A fully worked example, start to finish

This is a real route in the codebase today
(`app/api/system/config/route.ts`) — a good first-route example because
it's public (no login required), read-only, and doesn't touch any specific
user's private data.

**Before:**
```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const { data: settings, error } = await supabase
      .from("system_config")
      .select("config_key, config_value, config_type")
      .eq("is_public", true);

    if (error) {
      console.error("[SYSTEM CONFIG] Error fetching settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch configuration" },
        { status: 500 }
      );
    }

    const config = settings.reduce((acc, curr) => {
      acc[curr.config_key] = curr.config_value;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[SYSTEM CONFIG] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**After:**
```ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const { rows: settings } = await query(
      `SELECT config_key, config_value, config_type
       FROM system_config
       WHERE is_public = true`,
    );

    const config = settings.reduce((acc, curr) => {
      acc[curr.config_key as string] = curr.config_value;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[SYSTEM CONFIG] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

Notice everything that stayed exactly the same: the response shape
(`{ config: {...} }`), the error message text, the 500 status code, even
the `console.error` log line. The **only** thing that changed is how the
data got fetched. That's the target for every route you do.

---

## 11. Your route list — work through these in order

Don't jump ahead or pick routes off-list without checking with each other
first — this order goes from safest/simplest to trickiest on purpose, and
it splits work so you're not both editing the same area.

**Batch 1 — public, read-only, no login required (start here, do these first):**
- `app/api/system/config/route.ts` (the worked example above — do this
  literally first, since you already have the before/after to check
  yourself against)
- `app/api/events/route.ts`
- `app/api/notifications/mark-all/route.ts` *(check first whether this one
  actually requires login before assuming it's public — read Step 1 of the
  recipe carefully)*

**Batch 2 — requires login, but only touches the logged-in user's own data
(apply section 8's rule carefully here — every query needs the explicit
owner filter):**
- `app/api/get-listed/latest/route.ts`
- `app/api/notifications/[notificationId]/route.ts`
- `app/api/invitations/pending/route.ts`
- `app/api/favorites/route.ts`

**Batch 3 — admin/staff routes (use `requireAdmin`/`requireStaff` from
section 5.3):**
- `app/api/admin/security/config/route.ts`
- `app/api/admin/security/summary/route.ts`
- `app/api/admin/forms/templates/route.ts`
- (more will be assigned as you finish these — there are dozens under
  `app/api/admin/`)

**For exactly who owns which routes and in what order, use
`docs/POSTGRES_MIGRATION_PLAN.md`** — it splits every route between Bilal
and Track A / Fahad and Track B by folder, including the `mobile/v1` routes
(now in scope — the React Native app is secondary right now, converting the
APIs is the priority; if a mobile route migration breaks something on the
app side, that gets fixed afterward, it's not a reason to hold off).

**Still held back for everyone, regardless of track** — payments
(`app/api/payments/`, `app/api/payment/`, PayFast, `mobile/v1/payments*`,
`mobile/v1/checkout`), bookings/tickets (`app/api/bookings/`,
`app/api/tickets/`, `mobile/v1/bookings*`, `mobile/v1/tickets*`), and
password/auth (`app/api/auth/`, `mobile/v1/auth/*`) — these touch money or
account security specifically, which is why they're separated out, not
because of any RN-app concern.

---

## 12. Checklist — go through this before every single push to `main`

Since there's no one reviewing after you push, this list is what stands in
for that. Don't push until every box is true.

```
Route(s) migrated:
[ ] Read the route fully, wrote down its exact response shape (Step 1)
[ ] Saved "before" output from the live/current version for every case
    (valid input, not-found, no-login, wrong-role) (Step 2)
[ ] Replaced Supabase auth check with the matching helper (5.2 / 5.3)
[ ] Replaced every supabase.from(...) with query(...) using $N placeholders
    — no user-provided value ever pasted directly into SQL text (Section 7)
[ ] Replaced any supabase.storage calls (5.4), if present
[ ] Checked: does this route touch a specific user's private data? If yes,
    the SQL explicitly filters by the logged-in user's id (Section 8)
[ ] "after" output diffs clean against "before" for every saved case
[ ] npm run typecheck — passes clean
[ ] npm run lint — passes clean
[ ] Manually checked the real page/screen that calls this route
[ ] Removed now-unused Supabase imports
[ ] Ran /code-review (or /code-review ultra for Phase 4 / high-risk routes)
    and it came back clean
[ ] This commit only contains this one route (or tightly-related group) —
    nothing unrelated bundled in
[ ] After pushing: checked the live site for this route within a few minutes
```

---

## 13. If something doesn't fit this guide

Most routes will follow this recipe exactly. If you hit one that's
confusing — a weird nested Supabase query you can't figure out how to
convert, or anything touching payments/auth specifically — don't guess.
You're expected to work this out yourselves rather than escalate it:

- **Ask Claude directly.** Paste the confusing route and ask it to explain
  what the Supabase code is actually doing, or to draft the Postgres
  version — then read what it gives you and check it against this guide
  (Section 7's SQL safety rules, Section 8's ownership-filter rule) before
  using it.
- **Run `/code-review`** on your draft before pushing — it'll catch a lot
  of "did I actually get this right" questions on its own.
- **Ask each other.** A second set of eyes from the other person on this
  project is often faster than anything else.

This isn't about never getting stuck — it's about the answer being
"figure it out with the tools above," not "wait for someone else to tell
you it's correct," since nobody downstream is positioned to review this
code line by line either. Move slowly, verify with the before/after diff
every time, and trust that process over asking permission.
