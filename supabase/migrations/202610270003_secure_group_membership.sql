-- Route all group membership changes through the role-checked SECURITY DEFINER RPC.
-- Direct table policies allowed admins to bypass role boundaries and let owners leave directly.
BEGIN;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.group_conversation_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.group_conversation_members TO authenticated;

DROP POLICY IF EXISTS "Users can join groups they create" ON public.group_conversation_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_conversation_members;
DROP POLICY IF EXISTS "Admins manage membership and users may leave" ON public.group_conversation_members;

-- Group creation is also atomic through create_group_conversation(); prevent orphan groups.
REVOKE INSERT ON TABLE public.group_conversations FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.group_conversations;

COMMIT;
