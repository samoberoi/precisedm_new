-- POLICY Admins can view all submissions on form_submissions
CREATE POLICY "Admins can view all submissions" ON public.form_submissions AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Users can insert their own submissions on form_submissions
CREATE POLICY "Users can insert their own submissions" ON public.form_submissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
-- POLICY Users can view their own submissions on form_submissions
CREATE POLICY "Users can view their own submissions" ON public.form_submissions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
-- POLICY Service role only on otp_codes
CREATE POLICY "Service role only" ON public.otp_codes AS PERMISSIVE FOR ALL TO public USING (false);
-- POLICY Users can insert their own profile on profiles
CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- POLICY Users can update their own profile on profiles
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- POLICY Users can view their own profile on profiles
CREATE POLICY "Users can view their own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- POLICY Admins can view all receipts on receipts
CREATE POLICY "Admins can view all receipts" ON public.receipts AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Deny client deletes on receipts on receipts
CREATE POLICY "Deny client deletes on receipts" ON public.receipts AS PERMISSIVE FOR DELETE TO anon,authenticated USING (false);
-- POLICY Deny client inserts on receipts on receipts
CREATE POLICY "Deny client inserts on receipts" ON public.receipts AS PERMISSIVE FOR INSERT TO anon,authenticated WITH CHECK (false);
-- POLICY Deny client updates on receipts on receipts
CREATE POLICY "Deny client updates on receipts" ON public.receipts AS PERMISSIVE FOR UPDATE TO anon,authenticated USING (false) WITH CHECK (false);
-- POLICY Users can view their own receipts on receipts
CREATE POLICY "Users can view their own receipts" ON public.receipts AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
-- POLICY seo_blog_posts_admin_all on seo_blog_posts
CREATE POLICY seo_blog_posts_admin_all ON public.seo_blog_posts AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY seo_indexing_log_admin_all on seo_indexing_log
CREATE POLICY seo_indexing_log_admin_all ON public.seo_indexing_log AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY seo_integrations_admin_all on seo_integrations
CREATE POLICY seo_integrations_admin_all ON public.seo_integrations AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY seo_keyword_cache_admin_all on seo_keyword_cache
CREATE POLICY seo_keyword_cache_admin_all ON public.seo_keyword_cache AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY seo_page_overrides_admin_all on seo_page_overrides
CREATE POLICY seo_page_overrides_admin_all ON public.seo_page_overrides AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY seo_page_overrides_public_read on seo_page_overrides
CREATE POLICY seo_page_overrides_public_read ON public.seo_page_overrides AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((applied_at IS NOT NULL));
-- POLICY Admins read seo_settings on seo_settings
CREATE POLICY "Admins read seo_settings" ON public.seo_settings AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Admins update seo_settings on seo_settings
CREATE POLICY "Admins update seo_settings" ON public.seo_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Deny client deletes on seo_settings on seo_settings
CREATE POLICY "Deny client deletes on seo_settings" ON public.seo_settings AS PERMISSIVE FOR DELETE TO anon,authenticated USING (false);
-- POLICY Deny client inserts on seo_settings on seo_settings
CREATE POLICY "Deny client inserts on seo_settings" ON public.seo_settings AS PERMISSIVE FOR INSERT TO anon,authenticated WITH CHECK (false);
-- POLICY seo_tasks_admin_all on seo_tasks
CREATE POLICY seo_tasks_admin_all ON public.seo_tasks AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Admins can view all subscriptions on subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
-- POLICY Users can insert their own subscriptions on subscriptions
CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
-- POLICY Users can update their own subscriptions on subscriptions
CREATE POLICY "Users can update their own subscriptions" ON public.subscriptions AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
-- POLICY Users can view their own subscriptions on subscriptions
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
-- POLICY Users can view their own roles on user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
