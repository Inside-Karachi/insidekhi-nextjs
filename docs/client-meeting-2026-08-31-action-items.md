# Inside Karachi — Client Meeting Action Items

**Date:** 2026-08-31
**Client:** Zaki
**Reference material:** Multiple screenshots provided by Zaki — treat these as the source of truth for the flows and layouts below. Store them in [`mobile-screenshots-ui-reference/`](../mobile-screenshots-ui-reference/) and link the relevant shot in each ticket.

> One-line summary: move fully to light mode, cut navigation depth to a 3-step max, restructure the bottom nav to 4 tabs, make partners and ad space first-class, and make listings readable without opening them.

---

## 1. Global / Design

### 1.1 Move to light mode completely
- Remove dark mode entirely for now. App ships light-mode only.
- Audit theme tokens, components, and any `dark:` variants; strip or neutralize.

### 1.2 Ad space
- Leave dedicated slots for ad space throughout the app.
- **Most ads are 3.5:1 ratio** — design placeholders/containers around this.
- Get sample ads from **Aawaiz** (he has some) to size and style the slots correctly.

### 1.3 3-step rule
- No user action should take more than **3 steps / 3 clicks**.
- Benchmark example: viewing a discount on **Melbrew** must be reachable in **max 3 clicks**.
- Apply this as a review gate on every flow.

### 1.4 Footer / bottom bar visibility
- The footer (bottom nav) should **almost never leave the user's screen**.
- Only allowed to hide on very detailed / immersive screens (e.g. full checkout, media views).

### 1.5 "Something missing?" yellow tile
- Add a yellow "something missing / help us improve this listing" tile **almost everywhere data is scraped**.
- Lets users contribute corrections and fill gaps in listing data.
- Needs a lightweight submission flow + somewhere for the team to review contributions.

---

## 2. Navigation

### 2.1 Bottom nav — 4 tabs only (for now)
| Tab | Notes |
|-----|-------|
| Home | Karachi map UI feature (see 6.1) |
| Explore | Was "Search". **Rename the search tab to "Explore".** Mixed search + AI "what to do right now" (see 4) |
| Events | "Within 7 days" carousel (see 3) |
| Deals + Discounts | "For You" + "All" tabs at the very top (see 5) |

- **Remove the Activity tab.**

### 2.2 Top-right header
- **Profile button** moves to the **top right**.
- Top right also holds:
  - **Bell icon** for notifications
  - **QR code scanner**

---

## 3. Events tab
- Add a **"within 7 days" carousel** near the top of the Events tab.
- **Event listing page** must show:
  - Who organized the event
  - Organizer history — how many events hosted before this, success metrics, etc.
- **Events checkout system:** follow the flow in the screenshots. Priority is **fewer taps**.

---

## 4. Explore tab (Search + AI)
**Owner: Umer**

- Merge the current "What to do right now" experience **into the Explore/Search tab** — one mixed surface.
- Any **long natural-language string** entered should **immediately trigger AI usage**:
  - Kick off the "what to do right now" agent
  - Agent may ask cross-questions and then suggest options
- Umer to build this against **whatever listings data we currently have**.
- Coordinate with whoever owns the listings dataset.

---

## 5. Deals + Discounts tab
- Two tabs at the **very top**: **"For You"** and **"All"**.
- **All listings must clearly show the % discount** and the other info that matters to the user up front.
- The user should **not feel the need to open a listing** to understand what's inside it — surface the key details on the card.

---

## 6. Home / Map

### 6.1 Karachi map UI — APPROVED
- Client approved the Karachi map UI feature on the home page.
- **Fahad continues** this work.
- Keep the client in the loop and show him progress.

---

## 7. Partners
- Show partners in a **more prominent** way across the app.
- **Make 1–2 listings "Insider Partners"** as a test of the treatment.
- Define what the "Insider Partner" badge/placement looks like and where it appears.

---

## 8. Account hierarchy & roles

### 8.1 Event organizer account audit
- Review the **event organizer account hierarchy**.
- Confirm: **do we have an account type for the event gate-pass / check-in user?** If not, spec one.

### 8.2 Account switcher (organizer ↔ normal user)
- An event organizer is **also a normal user**.
- Add an **account switcher on the profile page**: switch to normal user and switch back.
- Switching triggers a **1–2 second splash** while the role changes; the **entire UI updates** to the new role.

---

## 9. Venue page
- Venue page should be **expandable** to show full venue details.

---

## 10. Remove / hide

### 10.1 Saved / changeable location feature (Bilal)
- **Remove the saved-locations feature** built by Bilal where the location is changeable.
- **Hide it for now** — not deleted; may be reintroduced later.

---

## 11. Ranking / XP system — REPORT NEEDED
**Owner: Fahad (already assigned)**

Investigate and produce a written report covering:
- What the ranking system currently does / how it works today.
- What XP mechanics exist.
- **Which actions grant XP and which don't.**
- Gaps and recommendations.

Deliver the report at the end of the investigation.

---

## Owner summary

| Area | Owner |
|------|-------|
| Explore AI search / "what to do right now" | Umer |
| Ranking + XP audit & report | Fahad |
| Karachi map UI (home page) | Fahad |
| Sample ads (3.5:1) — source material | Aawaiz |
| Saved-locations feature (being hidden) | Bilal (original author) |

## Open questions / to confirm
- Exact ad slot dimensions once Aawaiz shares samples.
- Which 1–2 listings become Insider Partners.
- Whether a gate-pass checker account type already exists.
- Final visual spec for the Insider Partner treatment.
