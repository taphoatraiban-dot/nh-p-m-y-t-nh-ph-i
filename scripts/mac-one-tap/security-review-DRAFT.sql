-- DRAFT ONLY. DO NOT APPLY WITHOUT BACKUP, REVIEW, AND ROLE TESTS.
-- Policies read on 2026-10-28 are broad: anon may SELECT all print rows,
-- INSERT rows, and UPDATE every pending row.
-- This draft is specifically for print_queue; check all dependencies first.
BEGIN;
DROP POLICY IF EXISTS mac_read_print_queue ON public.print_queue;
DROP POLICY IF EXISTS mac_update_print_queue ON public.print_queue;
DROP POLICY IF EXISTS web_insert_print_queue ON public.print_queue;
DROP POLICY IF EXISTS web_select_print_queue ON public.print_queue;
DROP POLICY IF EXISTS print_queue_insert_own ON public.print_queue;

CREATE POLICY print_queue_insert_own ON public.print_queue
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY print_queue_select_own ON public.print_queue
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
-- No anonymous access and no client UPDATE. Only a protected server role may ack.
COMMIT;
