# Iho enquiry intake rollout (not live)

## Current state
- Existing public registration remains on Formspree. Do not remove it until replacement is verified.
- The proposed Cloudflare Pages Function `functions/api/join.js` is not wired to the public form.
- No production D1 database has been connected to this endpoint.
- No automated acknowledgement email is configured. Resend remains unchanged.

## Required before production
1. Identify which Cloudflare Pages/Worker deployment actually serves `iho.co.nz`. GitHub repository alone does not establish hosting.
2. Create a separate restricted D1 database for Iho enquiries, apply the reviewed `0008_iho_interest_intake.sql` migration from the Operations Hub repo, and bind it as `IHO_INTAKE_DB` only on the verified site deployment. Do not reuse Relationships fictional data or whanau.site databases.
3. Configure Turnstile widget on the public form, bind `TURNSTILE_SECRET_KEY` as a secret, and switch submission to same-origin `/api/join` only after verified end-to-end tests. Current code deliberately retains Formspree.
4. Test valid/invalid consent, invalid Turnstile, origin handling, D1 failures, duplicates, mail delivery, and private dashboard access. Add rate limiting and abuse monitoring. Ensure email addresses and enquiry text never appear in logs.
5. Create owner-only authenticated read/update APIs and a follow-up dashboard. Avoid making the public endpoint return private enquiry data.
6. Add privacy notice, retention/deletion policy, export/withdrawal requests and separate opt-in/unsubscribe management. A positive opt-in must never be inferred from submitting an enquiry.
7. Implement a durable acknowledgement/outbox mechanism, then verify the chosen email provider and DNS SPF/DKIM/DMARC before considering replacing Resend.
8. Roll out gradually and monitor delivery, database errors and consent records. Do not send newsletters to prior Formspree enquiries without documented consent.

## Known limitation
The initial schema has a unique email+trust constraint. Duplicate submissions currently return a generic success response and do not update consent. Consent changes must be handled through an authenticated, auditable preference flow; do not infer new permission from a duplicate submission.
