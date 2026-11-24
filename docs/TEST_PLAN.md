# Test plan and results

## A. Automated tests – `cd server && npm test`

Last run: **39 passed, 0 failed** (Node 22, no database required).

| File | What it proves |
|---|---|
| `codes.test.js` | Generated codes have the right shape and pass their own check; 10,000 codes are all distinct; every single-character typo at every position is rejected; a code made with a different secret is rejected; look-alike/case/spacing normalisation; hash is keyed and never contains the code. |
| `claimService.test.js` | Valid claim credits points once; second claim of a used code (same or other user) → 409; **25 users claiming the same code at once → exactly one wins**; double-click by one user → one credit; typo → 400; unknown → 404; void/expired → 410; 5 failures lock the account, even a valid code is refused while locked; lock expires; old failures don't accumulate; success resets the counter; daily cap; suspended users blocked; **rollback** releases the code if crediting fails; attempt log never holds the plaintext code; **10 parallel wrong guesses still lock the account** (regression test for a bug found in review). |
| `redemptionService.test.js` | Redeem debits points, takes stock, writes a ledger row; insufficient points; inactive/unknown reward; out of stock refunds the points; unlimited stock; **6 parallel redemptions with points for one → one succeeds, balance never negative**; **two users, last item → one wins, loser keeps points**; rollback on failure; suspended users; fulfil keeps points; reject refunds + restocks + ledger nets to zero; **resolving twice refunds once**. |
| `rateLimit.test.js` | Fixed-window limiter with an injected clock. |

**Limits of these tests:** they run the service logic against an in-memory store whose "atomic"
operations mimic MongoDB single-document updates. They do not prove MongoDB's own behaviour, the HTTP
layer or the UI – that is what section B is for.

## B. Manual test checklist (database, API and UI)

Set up: `docker compose up -d`, `npm run seed` (note the 10 demo codes), start server and client.
Fill in the **Result** column when you run it (✔ / ✘ and a note).

| # | Steps | Expected | Result |
|---|---|---|---|
| 1 | Register a customer with an 8+ char password | Redirected to home, points = 0 | |
| 2 | Register with the same email again | Error "That value already exists" | |
| 3 | Sign in with a wrong password | Generic "Incorrect email or password" | |
| 4 | As customer, open `/admin` | Redirected to `/` | |
| 5 | `curl` an `/api/admin/stats` call with the customer's token | 403 | |
| 6 | Claim a demo code | "+25 points", balance 25, ledger shows Earn | |
| 7 | Claim the same code again | "This code has already been used" | |
| 8 | Claim it with a second customer account | Same rejection; second customer's points unchanged | |
| 9 | Enter the code in lower case without dashes | Accepted (or "already used" if step 6 done) | |
| 10 | Change one character of a fresh code | "Does not look right…" | |
| 11 | Enter 5 random well-formed-looking wrong codes | 5th shows "Locked for 15 minutes"; valid code also refused | |
| 12 | Owner → Security | The locked customer appears under repeated failures | |
| 13 | Owner → Customers → Suspend that customer | Customer can no longer sign in / API returns 403 | |
| 14 | Owner → Batches: generate 5 codes, download CSV | CSV has serial, code, claim_url; codes work | |
| 15 | Reload the Batches page | Codes cannot be shown again; only counts | |
| 16 | Open `/claim?code=…` while signed out | Sign-in first, then the code is pre-filled | |
| 17 | Owner → void a batch, then claim one of its codes | "This code is no longer valid" | |
| 18 | In MongoDB shell: `db.codes.findOne()` | No plaintext code field, only `codeHash` | |
| 19 | Fire the same claim 20× in parallel (e.g. `xargs -P20 curl …`) | Exactly one 200, rest 409/429; points credited once | |
| 20 | Customer with enough points redeems a reward | Balance drops, request "pending" | |
| 21 | Customer tries a reward costing more than balance | Button disabled; API returns insufficient points | |
| 22 | Owner → Redemptions → Reject | Customer's points restored, stock +1, history shows Refund | |
| 23 | Owner → Redemptions → Fulfil another | Status fulfilled; points stay spent | |
| 24 | Click Fulfil twice quickly / in two tabs | Second gets "already handled" | |
| 25 | Owner → Rewards: set stock 1, two customers redeem simultaneously | One succeeds, other "out of stock" and keeps points | |
| 26 | Owner → Overview | Counts, chart and top customers match what you did | |
| 27 | Resize to phone width | No horizontal page scroll; tables scroll inside cards | |
