# MAVEN Mysteries portal

## Activate once
1. Wait for the latest GitHub commit to deploy successfully in Cloudflare.
2. In the mavenpublications Worker, open Settings > Variables and Secrets (runtime settings, not build variables).
3. Add a Secret named ADMIN_BOOTSTRAP_CODE. Use a unique random value of at least 16 characters (24 or more recommended), saved in your password manager. Do not paste it into chat or commit it to GitHub.
4. Save and deploy the settings.
5. Visit /portal.html?admin=1 and sign in with that master code. The first successful configuration initializes a persistent hashed master credential. No default master code exists.
6. Upload the four PDFs under case ID the-last-recording. Assign each its correct category: instructions, case-file, hints, solution. Maximum 5 MB per file.
7. Create a code for a buyer and copy it immediately. The code is shown only once and is never stored in plaintext. Deliver it with the buyer portal URL /portal.html.

Master changes in the portal take effect immediately and invalidate all admin sessions. After initialization, changing ADMIN_BOOTSTRAP_CODE will NOT reset the master code. Keep the current master code safe; no automated reset workflow is included. The bootstrap secret can be removed after the master credential is initialized.

Buyer codes grant access to one case, remain reusable until revoked, and do not require buyer accounts. They are bearer credentials: anyone who receives a valid code can use it. Revoking access does not delete PDF copies already downloaded. Lost codes should be revoked and replaced. Buyer references need not contain personal information.

## Storage and deployment
The SQLite-backed CaseVault Durable Object stores master hashes, buyer-code hashes, session records and PDF chunks. No case PDFs or codes are committed to the public repository. Storage persists across deployments; retain the binding and migration. The free Cloudflare plan supports this storage type, subject to its limits. Runtime sessions last eight hours and use Secure, HttpOnly, SameSite=Strict cookies. Login attempts are limited to 10 per IP per 15-minute window. Hints and solution downloads require the same case entitlement as the other files; their reveal controls prevent accidental spoilers, not access by an entitled buyer.

The existing deploy command can stay unchanged because wrangler.jsonc specifies worker.mjs and storage bindings. The .assetsignore allowlist must include only index.html, mysteries.html, and portal.html. Backend source and build metadata are excluded from static assets.

Validation: node test.mjs exercises authorization, code uniqueness, case isolation, PDF chunk storage and downloads, revocation, master changes, persistence, origin protection, and rate limiting. Wrangler dry run passed. Chromium UI testing was blocked by the execution environment's socket restrictions. Live deployment, login and file uploads must still be verified on Cloudflare.
