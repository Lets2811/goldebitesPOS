-- Push to the installed phone apps (the courier's Android/iPhone app). They
-- get notifications through Firebase Cloud Messaging with a device token,
-- not through Web Push like the browser (push_subscriptions).
CREATE TABLE push_native_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id),
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_push_native_tokens_user ON push_native_tokens (user_id);
