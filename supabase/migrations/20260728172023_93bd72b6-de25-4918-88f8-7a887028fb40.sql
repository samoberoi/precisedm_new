
-- 1. Revoke EXECUTE on SECURITY DEFINER helper/trigger functions from client roles.
-- has_role remains executable by authenticated because RLS policies invoke it as the client role.
REVOKE EXECUTE ON FUNCTION public.trigger_indexing_ping(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seo_blog_indexing_ping() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_subscription_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2. Receipts: lock down writes so only service role (webhooks/edge functions) can write.
REVOKE INSERT, UPDATE, DELETE ON public.receipts FROM anon, authenticated;
-- Add explicit deny policies so any future GRANT is still blocked at the row level.
DROP POLICY IF EXISTS "Deny client inserts on receipts" ON public.receipts;
CREATE POLICY "Deny client inserts on receipts" ON public.receipts FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS "Deny client updates on receipts" ON public.receipts;
CREATE POLICY "Deny client updates on receipts" ON public.receipts FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny client deletes on receipts" ON public.receipts;
CREATE POLICY "Deny client deletes on receipts" ON public.receipts FOR DELETE TO authenticated, anon USING (false);

-- 3. seo_page_overrides: only expose rows that have been applied to a live page,
-- and never leak internal task linkage via unrestricted public read.
DROP POLICY IF EXISTS seo_page_overrides_public_read ON public.seo_page_overrides;
CREATE POLICY seo_page_overrides_public_read ON public.seo_page_overrides
  FOR SELECT
  TO anon, authenticated
  USING (applied_at IS NOT NULL);

-- 4. seo_settings: ensure no unintended write path exists for non-admins.
-- RLS is already enabled with admin-only SELECT/UPDATE; add explicit deny policies for INSERT/DELETE.
DROP POLICY IF EXISTS "Deny client inserts on seo_settings" ON public.seo_settings;
CREATE POLICY "Deny client inserts on seo_settings" ON public.seo_settings FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS "Deny client deletes on seo_settings" ON public.seo_settings;
CREATE POLICY "Deny client deletes on seo_settings" ON public.seo_settings FOR DELETE TO authenticated, anon USING (false);
