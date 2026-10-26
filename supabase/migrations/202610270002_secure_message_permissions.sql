-- Secure message updates: sender edit/delete and recipient read status.
-- Safe to apply to databases where the legacy recipient UPDATE policies exist.

BEGIN;

-- Remove broad table-level UPDATE access, then permit direct body edits only.
REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE (body) ON TABLE public.messages TO authenticated;

-- Remove the legacy recipient policies; read status is updated via the RPC below.
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Recipients can mark messages as delivered" ON public.messages;

DROP POLICY IF EXISTS "Senders can edit their own messages" ON public.messages;
CREATE POLICY "Senders can edit their own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.messages;
CREATE POLICY "Senders can delete their own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Recipients can set read_at only for messages addressed to them.
-- SECURITY DEFINER permits this narrow update without granting direct read_at UPDATE.
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.messages
  SET read_at = pg_catalog.now()
  WHERE id = p_message_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_message_read(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_read(bigint) TO authenticated;

COMMIT;
