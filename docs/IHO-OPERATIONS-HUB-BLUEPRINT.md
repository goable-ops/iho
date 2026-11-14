# Iho Operations Hub — implementation blueprint (draft)

Status: planning only. No production migrations or email automation enabled.

## Purpose
One secure administrative workspace for iho operations: contact enquiries, approved outreach, content planning, whanau.site pilot milestones, funding evidence and tasks. The Hub is **not** a shared database of whānau whakapapa or trust records.

## Verified code findings (14 November 2026)
- iho public website: `goable-ops/iho`, `index.html`.
- The expression-of-interest UI currently collects name, email, trust/marae, region, role, optional challenge.
- `sub()` sends only `name`, `email`, `trust` to Formspree endpoint `https://formspree.io/f/maqzldnw`.
- The current success UI does not check `response.ok`; no network error handler. Submission may appear successful after an HTTP error.
- The public form does not currently capture separate opt-in for ongoing promotional updates or surveys. Its notice limits use to contacting about Iho.
- `goable-ops/ittmswhanausite` is private; its server functions use Supabase and signed session authentication. Do not import its private member or whakapapa data into the operations CRM.

## Architecture decision
- New private application at proposed `admin.iho.co.nz`, separate private GitHub repository, Cloudflare deployment, strong administrator authentication and MFA.
- Separate operational contact database, subject to privacy/data-residency assessment. Do not assume Cloudflare D1 automatically meets NZ residency requirements.
- Iho website submits enquiries to a validated server-side endpoint, never directly to an exposed administrative database.
- Approved email delivery provider handles transactional messages and consented updates; credentials stored in server-side secrets only.
- Pilot site reports **approved, non-sensitive** feature milestones to the Hub; no shared access to private Supabase records.
- AI services may draft and categorise minimally necessary content, but cannot send unapproved novel replies, promise funding or access private trust records.

## Minimum viable release
1. Protected login and roles; audit logging and backup/restore tests.
2. Contact list, deduplication, enquiry source, timestamps, status, next action, opt-in evidence and conversation history.
3. Reliable form endpoint with validation, abuse controls, error handling, secure logging, retry and alerting. Preserve existing submissions in Formspree during migration.
4. Transactional acknowledgement only after successful persistence; admin notification; no unsolicited marketing.
5. Follow-up task queue with human review and suppression/unsubscribe controls.
6. Task and pilot milestone board with explicit approval before any public/customer update.

## Required checks before any production change
- Confirm Formspree inbox, existing first enquiry and any configured notification rules; do not delete or overwrite.
- Confirm exact live Cloudflare project and whether deployed code matches GitHub main.
- Inspect Cloudflare environment bindings and secrets **without copying secret values**.
- Review NZ Privacy Act 2020, overseas disclosure, retention, access/deletion, breach handling and Māori data sovereignty with whānau governance.
- Define who can administer Hub, use MFA, access controls, backups, monitoring, rate limits and change approvals.
- Test the form in a staging environment including failed requests and duplicate submissions.
- Verify mail domain and delivery/authentication configuration before enabling automated messages.

## Proposed data entities (no private trust data)
- contacts: ID, display name, email, organisation, role, region, created_at, source, status
- consents: contact_id, purpose, policy_version, evidence, granted_at, revoked_at
- enquiries: contact_id, submitted_at, category, summary, source, next_action_at
- communications: contact_id, channel, direction, status, template_version, timestamp
- tasks: type, assignee, due_at, status, linked_contact_id or project_id
- milestones: project, title, public_summary, verification, approval_status, release_date
- audit_events: actor, action, resource_id, timestamp (no message bodies)

## Delivery sequence
A. Audit & backup current contact flow; map existing Formspree data.
B. Design permissions, consent and database location; review with owner.
C. Implement staging Hub, secure auth, contacts and tasks.
D. Build form ingestion and import historical enquiries with reconciliation.
E. Add welcome and follow-up workflows with approval and unsubscribe safeguards.
F. Add approved pilot milestones, social and funding integrations.

## First success criterion
A test enquiry is saved exactly once, appears in the protected Hub, triggers a correctly delivered acknowledgement, creates a follow-up task, and survives retries and simulated service failures without a false success message.
