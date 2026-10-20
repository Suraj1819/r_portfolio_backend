-- Contact messages table for portfolio enquiries
-- Retention: review and delete messages older than 24 months, or sooner on request.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS contact_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  subject       VARCHAR(180) NOT NULL,
  inquiry_type  VARCHAR(50),
  message       TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'read', 'replied', 'archived')),
  email_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages (status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email_status ON contact_messages (email_status);

-- Example retention cleanup (run periodically via cron or admin process):
-- DELETE FROM contact_messages WHERE created_at < NOW() - INTERVAL '24 months';
