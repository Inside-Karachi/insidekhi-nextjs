# Postgres Migration — Work Plan for Bilal & Fahad

This is the "who does what, in what order" plan. For "how do I actually
migrate one route," use `docs/POSTGRES_MIGRATION_GUIDE.md` — this document
just tells you which files are yours and in what sequence.

The two tracks below touch **completely separate folders**, so you can both
work at the same time without ever colliding on the same file. Work through
your own list top to bottom — don't skip ahead to a later item until the one
above it is merged.

The React Native app itself (`insidekhi-reactnative`) is secondary right
now — converting these APIs is the priority. That includes the
`app/api/mobile/v1/**` routes (added as Phase 5 below for each of you) —
they're not off-limits. If migrating one of them changes something the
mobile app notices, that gets fixed afterward; it's not a reason to hold
off on the migration itself.

---

## Track A — Bilal: Listings & Business-Owner domain

**Owns:** everything under `app/api/business/**`, `app/api/admin/listings/**`,
and (Phase 5) the listings/categories/banks-adjacent routes under
`app/api/mobile/v1/**` listed below. Nobody else touches these folders.

**Phase 1 — reads and simple writes:**
1. `app/api/business/listings/route.ts`
2. `app/api/business/dashboard/stats/route.ts`
3. `app/api/business/analytics/route.ts`
4. `app/api/business/reviews/route.ts`
5. `app/api/business/reviews/reply/route.ts`
6. `app/api/business/reviews/reply/[id]/route.ts`
7. `app/api/business/change-requests/route.ts`
8. `app/api/business/change-requests/[id]/route.ts`

**Phase 2 — the listing record itself and its sub-resources:**
9. `app/api/admin/listings/ids/route.ts`
10. `app/api/admin/listings/edit-presence/route.ts`
11. `app/api/admin/listings/[id]/owners/route.ts`
12. `app/api/admin/listings/[id]/features/route.ts`
13. `app/api/admin/listings/approvals/route.ts`
14. `app/api/business/listings/[id]/route.ts`
15. `app/api/business/listings/[id]/branches/route.ts`
16. `app/api/business/listings/[id]/branches/[branchId]/route.ts`
17. `app/api/business/listings/[id]/submit/route.ts`
18. `app/api/admin/listings/route.ts`
19. `app/api/admin/listings/[id]/route.ts`

**Phase 3 — file storage involved (do after `lib/storage/spaces.ts` feels familiar):**
20. `app/api/business/listings/[id]/gallery/route.ts`
21. `app/api/business/listings/[id]/gallery/[imageId]/route.ts`
22. `app/api/admin/listings/[id]/menu-pdf/route.ts`
23. `app/api/admin/listings/[id]/menu/sections/[sectionId]/items/[itemId]/image/route.ts`
24. `app/api/admin/listings/temp-images/cleanup/route.ts`

**Phase 4 — save for last, these are destructive/bulk operations, get an
extra careful review on these PRs specifically:**
25. `app/api/admin/listings/export/route.ts`
26. `app/api/admin/listings/bulk-delete-all/route.ts`
27. `app/api/admin/listings/import/route.ts`
28. `app/api/admin/listings/import/rollback/route.ts`

**Phase 5 — mobile API, same domain as the rest of this track:**
29. `app/api/mobile/v1/categories/route.ts`
30. `app/api/mobile/v1/banks/route.ts`
31. `app/api/mobile/v1/sort-options/route.ts`
32. `app/api/mobile/v1/site-settings/route.ts`
33. `app/api/mobile/v1/listings/route.ts`
34. `app/api/mobile/v1/listings/[slug]/route.ts`

---

## Track B — Fahad: Events, Organizer & Community domain

**Owns:** everything under `app/api/organizer/**`, `app/api/events/**`,
`app/api/admin/events/**`, `app/api/notifications/**`, `app/api/favorites/**`,
`app/api/reviews/**`, `app/api/invitations/**`, and (Phase 5) the
events/community-adjacent routes under `app/api/mobile/v1/**` listed below.
Nobody else touches these folders.

**Phase 1 — simple, public or single-table:**
1. `app/api/events/route.ts`
2. `app/api/notifications/route.ts`
3. `app/api/notifications/mark-all/route.ts`
4. `app/api/notifications/[notificationId]/route.ts`
5. `app/api/notifications/seed/route.ts`
6. `app/api/favorites/route.ts`
7. `app/api/invitations/pending/route.ts`
8. `app/api/invitations/stats/route.ts`

**Phase 2 — a bit more logic, still no storage:**
9. `app/api/invitations/create/route.ts`
10. `app/api/invitations/accept/route.ts`
11. `app/api/reviews/route.ts`
12. `app/api/reviews/[reviewId]/helpful/route.ts`
13. `app/api/reviews/[reviewId]/comments/route.ts`
14. `app/api/reviews/[reviewId]/comments/[commentId]/route.ts`
15. `app/api/reviews/[reviewId]/comments/[commentId]/replies/route.ts`
16. `app/api/organizer/form-data/route.ts`
17. `app/api/organizer/[organizerId]/stats/route.ts`

**Phase 3 — organizer + event management:**
18. `app/api/organizer/events/route.ts`
19. `app/api/organizer/events/manage/route.ts`
20. `app/api/organizer/attendees/route.ts`
21. `app/api/organizer/notify/route.ts`
22. `app/api/organizer/events/[eventId]/tickets/route.ts`
23. `app/api/admin/events/route.ts`
24. `app/api/admin/events/[id]/route.ts`
25. `app/api/admin/events/[id]/organizers/route.ts`
26. `app/api/admin/events/[id]/tickets/route.ts`
27. `app/api/admin/events/[id]/tickets/[ticketId]/route.ts`
28. `app/api/admin/events/approvals/route.ts`

**Phase 4 — file storage involved (do after `lib/storage/spaces.ts` feels familiar):**
29. `app/api/reviews/move-temp-images/route.ts`
30. `app/api/organizer/events/[eventId]/images/route.ts`
31. `app/api/organizer/events/temp-images/route.ts`
32. `app/api/organizer/events/temp-images/move/route.ts`
33. `app/api/organizer/events/temp-images/cleanup/route.ts`
34. `app/api/admin/events/[id]/images/route.ts`
35. `app/api/admin/events/[id]/images/[imageId]/route.ts`
36. `app/api/admin/events/temp-images/move/route.ts`
37. `app/api/admin/events/temp-images/cleanup/route.ts`

**Phase 5 — mobile API, same domain as the rest of this track:**
38. `app/api/mobile/v1/events/route.ts`
39. `app/api/mobile/v1/events/[slug]/route.ts`
40. `app/api/mobile/v1/notifications/route.ts`
41. `app/api/mobile/v1/notifications/mark-all/route.ts`
42. `app/api/mobile/v1/notifications/[notificationId]/route.ts`
43. `app/api/mobile/v1/favorites/route.ts`
44. `app/api/mobile/v1/favorites/list/route.ts`
45. `app/api/mobile/v1/reviews/route.ts`
46. `app/api/mobile/v1/reviews/[reviewId]/helpful/route.ts`
47. `app/api/mobile/v1/reviews/[reviewId]/comments/route.ts`
48. `app/api/mobile/v1/reviews/[reviewId]/comments/[commentId]/route.ts`
49. `app/api/mobile/v1/reviews/[reviewId]/comments/[commentId]/replies/route.ts`
50. `app/api/mobile/v1/reviews/[reviewId]/images/route.ts`
51. `app/api/mobile/v1/invitations/route.ts`
52. `app/api/mobile/v1/invitations/pending/route.ts`
53. `app/api/mobile/v1/invitations/stats/route.ts`
54. `app/api/mobile/v1/invitations/accept/route.ts`
55. `app/api/mobile/v1/search/route.ts`

---

## Not in this plan yet — don't pick these up on your own

- `app/api/tickets/**`, `app/api/bookings/**`, `app/api/admin/bookings/**`,
  `app/api/mobile/v1/tickets/**`, `app/api/mobile/v1/bookings/**`,
  `app/api/mobile/v1/checkout/route.ts` — these touch payment/checkout flow
  (PayFast). Held back until both tracks above are done; will be assigned
  individually with extra review. (This is about money/security risk
  specifically, not about the mobile app — same reason as the line below.)
- `app/api/auth/**`, `app/api/payments/**`, `app/api/payment/**`,
  `app/api/mobile/v1/auth/**`, `app/api/mobile/v1/payments/**` — same
  reason, higher stakes, later.
- Any `app/api/admin/**` folder not listed above (users, security, forms,
  gamification, logs, categories, analytics), plus the remaining
  `app/api/mobile/v1/**` routes that don't cleanly fit either track's domain
  (`profile/**`, `gamification/**`, `contact`, `newsletter`, `membership`,
  `shares`, `settings`, `dashboard/sidebar-stats`, `location`) — will be
  split between you once both tracks above are finished, so you're not
  guessing who owns what mid-flight.

Note: RLS (Supabase's old automatic access control) is not something to
investigate or work around route by route — see the guide's Section 8,
which now just says: every route touching a specific user's data gets an
explicit ownership check in the SQL, always, regardless of what Supabase
was or wasn't doing before.

## Working in parallel without colliding

- Track A and Track B never share a folder — if you ever find yourself
  about to edit a file under the other person's track, stop, that means
  something in this plan is wrong, flag it instead of just doing it.
- Each of you commits and pushes directly to `main`, one route (or
  tightly-related group) per commit, per the workflow in the guide
  (Section 9). Since you're both pushing to the same shared branch, always
  `git pull` before starting and `git pull --rebase` right before you push
  — you don't need to coordinate on *when* you push, just on which folders
  you own (which this doc already settles), since that's what keeps your
  commits from ever touching the same file.
- If you finish your current phase before the other person finishes theirs,
  move to your own next phase — don't start pulling from the other track's
  list.
- Check in with each other (not necessarily Shuja) when you both reach the
  end of Phase 3 on your respective tracks, to jointly figure out how to
  split the "not in this plan yet" bucket.
