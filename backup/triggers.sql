CREATE TRIGGER set_subscription_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
CREATE TRIGGER update_seo_integrations_updated_at BEFORE UPDATE ON public.seo_integrations FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
CREATE TRIGGER seo_tasks_updated_at BEFORE UPDATE ON public.seo_tasks FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
CREATE TRIGGER trg_seo_blog_posts_updated BEFORE UPDATE ON public.seo_blog_posts FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
CREATE TRIGGER trg_seo_page_overrides_updated BEFORE UPDATE ON public.seo_page_overrides FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at();
CREATE TRIGGER trg_seo_blog_indexing AFTER INSERT OR UPDATE ON public.seo_blog_posts FOR EACH ROW EXECUTE FUNCTION tg_seo_blog_indexing_ping();
