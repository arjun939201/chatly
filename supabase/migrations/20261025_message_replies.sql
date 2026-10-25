-- Chatly #5: message replies
-- Run this migration in the Supabase SQL Editor before using replies.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to bigint NULL
  REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx
  ON public.messages(reply_to);
