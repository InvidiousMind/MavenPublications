# MAVEN Mysteries portal

## Activate once
1. Wait for the latest GitHub commit to deploy successfully in Cloudflare.
2. In the mavenpublications Worker, open Settings > Variables and Secrets (runtime settings, not build variables).
3. Add a Secret named ADMIN_BOOTSTRAP_CODE. Use a unique random value of at least 16 characters (24 or more recommended), saved in your password manager. Do not paste it into chat or commit it to GitHub.
4. Save and deploy the settings.
5. Visit /portal.html?admin=1 and sign in with that master code. The first successful configuration initializes a persistent hashed master credential. No default master code exists.
6. Upload the four PDFs under case ID the-last-recording. Assign each its correct category: instructions, case-file, hints, solution. Maximum 5 MB per file.
7. Enter the buyer's CRM customer number (MAV-000001 format) and purchase date. Create a code for that buyer and copy it immediately. The code is shown only once and is never stored in plaintext. Deliver it with the buyer portal URL /portal.html.

Master changes in the portal take effect immediately and invalidate all admin sessions. After initialization, changing ADMIN_BOOTSTRAP_CODE will NOT reset the master code. Keep the current master code safe. Recovery is available through a one-time Cloudflare runtime secret, as described below. The bootstrap secret can be removed after the master credential is initialized.

Buyer codes grant access to one case, expire at 00:00 Europe/Istanbul on the one-year anniversary of the purchase date, or earlier if revoked, and do not require buyer accounts. They are bearer credentials: anyone who receives a valid code can use it. Revoking access does not delete PDF copies already downloaded. Lost codes should be revoked and replaced. Buyer references need not contain personal information.

## Storage and deployment
The SQLite-backed CaseVault Durable Object stores master hashes, buyer-code hashes, session records and PDF chunks. No case PDFs or codes are committed to the public repository. Storage persists across deployments; retain the binding and migration. The free Cloudflare plan supports this storage type, subject to its limits. Runtime sessions last eight hours and use Secure, HttpOnly, SameSite=Strict cookies. Login attempts are limited to 10 per IP per 15-minute window. Hints and solution downloads require the same case entitlement as the other files; their reveal controls prevent accidental spoilers, not access by an entitled buyer.

The existing deploy command can stay unchanged because wrangler.jsonc specifies worker.mjs and storage bindings. The .assetsignore allowlist must include only index.html, mysteries.html, and portal.html. Backend source and build metadata are excluded from static assets.

Validation: node test.mjs exercises authorization, code uniqueness, case isolation, PDF chunk storage and downloads, revocation, master changes, persistence, origin protection, and rate limiting. Wrangler dry run passed. Chromium UI testing was blocked by the execution environment's socket restrictions. Live deployment, login and file uploads must still be verified on Cloudflare.

## Recover a forgotten master code
After the recovery update deploys, add a runtime Secret named ADMIN_RESET_CODE in the mavenpublications Worker's Settings > Variables and Secrets (not build settings). Choose a fresh random code of 16–200 characters and save it privately. Save and deploy. Open /portal?admin=1 and log in with that code. On its first use it becomes the new master code and invalidates previous admin sessions, preserving buyer codes and case PDFs. Each distinct recovery value can perform this reset only once. Remove ADMIN_RESET_CODE from Cloudflare after successful login. You can then change the master code from the portal. A previously consumed recovery value cannot reset it again, even if it is left configured. Never put recovery secrets into GitHub, Drive source files, or chat.

## Manage mystery cases
In the admin portal, use Manage MAVEN Mystery cases to enter a title, permanent case ID and spoiler-free public description. Save new cases as Draft. Use Manage PDFs to select that case in the upload panel. Upload separate PDFs for instructions, case-file, hints and solution (5 MB maximum each). Edit the case, select Published, and save when all four categories are present. The public Mysteries catalogue reads published records automatically, so no code deployment is required for future cases. Draft and Archived records are not listed publicly. Archiving does not revoke existing buyer codes; revoke them separately only if intended. Set a published case to Draft before deleting its PDFs. Existing The Last Recording metadata is registered as Draft the first time the case manager is opened, preserving its PDFs and access codes; publish it after checking its files.
