-- Apply only to a separately provisioned Iho intake database after privacy review.
-- Never run against the fictional relationships development DB or whānau pilot DB.
CREATE TABLE IF NOT EXISTS iho_interest_enquiries (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 trust_name TEXT NOT NULL,
 region TEXT,
 role_label TEXT,
 message TEXT,
 source TEXT NOT NULL DEFAULT 'iho.co.nz/join',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','contacted','interested','closed')),
 last_contact_at TEXT,
 next_followup_at TEXT,
 acknowledgement_status TEXT NOT NULL DEFAULT 'pending' CHECK(acknowledgement_status IN ('pending','sent','failed')),
 privacy_notice_version TEXT NOT NULL,
 updates_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(updates_opt_in IN (0,1)),
 updates_opt_in_at TEXT,
 updates_opt_out_at TEXT,
 CHECK (updates_opt_in = 0 OR updates_opt_in_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_iho_interest_email_trust ON iho_interest_enquiries(email,trust_name);
CREATE INDEX IF NOT EXISTS idx_iho_interest_followup ON iho_interest_enquiries(status,next_followup_at);
CREATE TABLE IF NOT EXISTS iho_interest_events (
 id TEXT PRIMARY KEY,
 enquiry_id TEXT NOT NULL REFERENCES iho_interest_enquiries(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL,
 detail TEXT,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_iho_interest_events_enquiry ON iho_interest_events(enquiry_id,created_at);

