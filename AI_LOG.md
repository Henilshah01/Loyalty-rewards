# AI Log

How AI (Claude) was used on this project, what I asked, and where it was wrong.

**Chat link:** [Claude conversation](https://claude.ai/share/89aa5260-4041-4fd6-9696-a9b63bd1a890)

## 1. Turning the brief into a design – *prompt*

**Prompt (summary):** Gave Claude the assignment PDF and asked for a brief of the requirements, a complete
MERN implementation with folder structure, a minimal MVP-quality UI and the required repo documents.

**What came back / my decision:** A summary of the three questions the brief poses (proof of purchase,
fraud/reuse, owner management) and a design built around a unique single-use code per box, stored only as a
keyed hash, claimed through one atomic database update. I kept this because it answers all three
questions with one mechanism and needs no integration with shops or a payment system.

## 2. Making the rules testable without a database – *AI design decision*

**Context:** The claim and redemption logic must be provable under concurrent requests, but
no database was available in the build environment. Claude chose this approach itself; I did not ask for it.

**Outcome:** Services receive their data access as a `deps` object. `repo.js` implements it on MongoDB
and `tests/helpers/fakeStore.js` implements it in memory, so race conditions (25 people claiming the
same code at once) can be tested. **Limit I accepted and documented:** the fake store only mimics
MongoDB's atomic updates; the manual checklist in `docs/TEST_PLAN.md` covers the real database.

## 3. AI was wrong: it overwrote earlier work – *mistake caught*

**What happened:** I asked Claude to build the project from the assignment PDF. Claude started writing a
fresh backend without first listing the folder. A previous session had already built a different
structure (`lib/`, `repo.js`, `models/index.js` with named exports). Claude's new files overwrote eight
model files and `package.json`, and added conflicting duplicates (`config/env.js`, `utils/errors.js`,
`services/codeService.js`).

**How it was noticed:** The file tool reported "updated" instead of "created" for files that were meant to
be new. Claude then listed the directory, found the earlier code and a git repo with no commits (so the
overwritten files could not be restored from history).

**How it was fixed:** Claude deleted its duplicate files, then rebuilt each overwritten model by reading
how `repo.js`, the services and the routes actually used it (field names such as `status: 'claimed'`,
`lockUntil`, `lifetimePoints`). The restored code was verified by 38 passing service tests and a syntax
check of every file. **Lesson:** inspect the working directory and commit early so history can protect
against this; every commit you make from now on should be small and frequent.

## 4. AI was wrong: the lockout could be bypassed – *mistake caught by a test*

**What happened:** The earlier implementation counted failed attempts like this: read the user, compute
`failedClaims + 1` in application code, write the result back. While finishing the project Claude
reviewed its own anti-fraud logic (I had not pointed at this) and suspected that parallel guesses would
each read the same old counter.

**How it was noticed:** Claude wrote a test first – ten wrong guesses fired in parallel, expecting the
account to lock. The test **failed**: the account never locked, because every request wrote
`failedClaims = 1`. An attacker could therefore try many codes at once without tripping the 5-strike lock
(only the IP rate limit would remain).

**How it was fixed:** The counter is now bumped with an atomic MongoDB `$inc` through a new data-access
function `registerFailure` (`repo.js`), and `claimService` no longer does arithmetic on a stale snapshot.
The regression test now passes (39/39). I ran checklist items 11 and 19 in `docs/TEST_PLAN.md` against MongoDB: [result].

## 5. Choosing a UI approach – *decision*

**My direction:** "UI should be minimal and decent for an MVP." Claude chose plain React with one small CSS file
(no component library): one customer page (points, claim box, rewards, history) and a six-tab owner area.
I accepted it because it keeps the bundle small, is easy to explain line by line, and supports dark mode and
phones with a few lines of CSS. It was syntax-checked but **not yet run in a browser** in the build
environment, so the UI portion of the manual checklist is mine to run.
I later replaced this design (see entry 6). Browser check of the first design: [what happened, or "not done"].

## 6. Redesigning the UI and adding QR codes – *prompt*

**Prompt:** My project was working, but the admin side could not show QR codes. I asked Claude for a minimal, creative redesign of both sides.

**What came back:** New customer and admin screens, printable QR labels and a QR link in the CSV. Claude said it had not run the new React code against the real app, and the QR library was untested.

**How I checked it:** [what you ran and what happened]
