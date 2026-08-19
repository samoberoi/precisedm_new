
-- Create user type enum
CREATE TYPE public.user_type AS ENUM ('student', 'practitioner');

-- Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_type public.user_type NOT NULL DEFAULT 'student',
  custom_user_id TEXT,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- User roles RLS
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, user_type, custom_user_id, accepted_terms)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'student'),
    NEW.raw_user_meta_data->>'custom_user_id',
    COALESCE((NEW.raw_user_meta_data->>'accepted_terms')::boolean, false)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_login = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  form_type TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own submissions"
ON public.form_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own submissions"
ON public.form_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
ON public.form_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  paypal_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'cancelled', 'expired', 'inactive', 'suspended')),
  start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_subscription_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();UPDATE subscriptions SET status = 'active', plan_type = 'yearly', start_date = now(), next_billing_date = now() + interval '1 year' WHERE user_id = '5eec1106-416a-42dc-bca1-c9f6a99139b2';ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check CHECK (plan_type = ANY (ARRAY['monthly', 'yearly', 'trial']));CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  full_name text,
  user_type text DEFAULT 'student',
  custom_user_id text,
  accepted_terms boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_otp_codes_email_code ON public.otp_codes (email, code);

CREATE POLICY "Service role only" ON public.otp_codes
  FOR ALL USING (false);
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  paypal_subscription_id TEXT,
  paypal_transaction_id TEXT UNIQUE,
  plan_type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_sent_at TIMESTAMPTZ,
  pdf_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX idx_receipts_payment_date ON public.receipts(payment_date DESC);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own receipts"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all receipts"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- SEO / AEO / GEO admin dashboard — schema (PreciseDM)
-- All tables admin-only. Fully isolated from existing app.
-- =========================================================

-- Ensure pg_net for async http (used by indexing trigger)
create extension if not exists pg_net with schema extensions;

-- 1. seo_integrations -------------------------------------
CREATE TABLE public.seo_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE DEFAULT 'google',
  property_url TEXT,
  refresh_token TEXT,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  connected_by_user_id UUID,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_integrations_admin_all" ON public.seo_integrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_seo_integrations_updated_at
  BEFORE UPDATE ON public.seo_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

-- 2. seo_keyword_cache ------------------------------------
CREATE TABLE public.seo_keyword_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_url TEXT NOT NULL,
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_keyword_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_keyword_cache_admin_all" ON public.seo_keyword_cache
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. seo_tasks --------------------------------------------
CREATE TABLE public.seo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week int NOT NULL DEFAULT 1,
  day_start int,
  day_end int,
  scheduled_date date,
  section text NOT NULL DEFAULT 'SEO',
  category text NOT NULL DEFAULT 'on-page',
  deliverable_type text,
  priority text NOT NULL DEFAULT 'medium',
  effort_minutes int NOT NULL DEFAULT 30,
  title text NOT NULL,
  description text,
  target_url text,
  target_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}',
  page_title text,
  meta_description text,
  content_brief text,
  status text NOT NULL DEFAULT 'todo',
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  blog_slug text,
  sort_order int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  verified_status text,
  verified_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_tasks_admin_all ON public.seo_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER seo_tasks_updated_at
  BEFORE UPDATE ON public.seo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();
CREATE INDEX seo_tasks_scheduled_date_idx ON public.seo_tasks(scheduled_date);

-- 4. seo_blog_posts ---------------------------------------
CREATE TABLE public.seo_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  url text not null,
  title text not null,
  meta_description text,
  primary_keyword text,
  secondary_keywords text[] not null default '{}',
  body_md text not null,
  scheduled_date date,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid,
  deployed_at timestamptz,
  client_notes text,
  internal_notes text,
  read_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE public.seo_blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_blog_posts_admin_all ON public.seo_blog_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_seo_blog_posts_updated
  BEFORE UPDATE ON public.seo_blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

-- 5. seo_settings -----------------------------------------
CREATE TABLE public.seo_settings (
  id INT PRIMARY KEY DEFAULT 1,
  blog_approval_required BOOLEAN NOT NULL DEFAULT true,
  auto_execute BOOLEAN NOT NULL DEFAULT true,
  last_auto_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.seo_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read seo_settings" ON public.seo_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update seo_settings" ON public.seo_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. seo_page_overrides -----------------------------------
CREATE TABLE public.seo_page_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path text NOT NULL UNIQUE,
  title text,
  meta_description text,
  h1 text,
  intro_copy text,
  target_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}'::text[],
  source_task_id uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_page_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_page_overrides_public_read ON public.seo_page_overrides
  FOR SELECT TO public USING (true);
CREATE POLICY seo_page_overrides_admin_all ON public.seo_page_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_seo_page_overrides_updated
  BEFORE UPDATE ON public.seo_page_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();
CREATE INDEX seo_page_overrides_route_path_idx ON public.seo_page_overrides(route_path);

-- 7. seo_indexing_log -------------------------------------
CREATE TABLE public.seo_indexing_log (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  action text not null default 'URL_UPDATED',
  source text,
  status text not null default 'pending',
  http_status int,
  response jsonb,
  error text,
  pinged_at timestamptz not null default now()
);
CREATE INDEX seo_indexing_log_pinged_at_idx ON public.seo_indexing_log (pinged_at desc);
ALTER TABLE public.seo_indexing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_indexing_log_admin_all ON public.seo_indexing_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: async http ping into the seo-indexing-ping edge function
CREATE OR REPLACE FUNCTION public.trigger_indexing_ping(_url text, _action text, _source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text;
  service_key text;
BEGIN
  BEGIN
    fn_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    fn_url := null;
  END;
  IF fn_url IS NULL OR fn_url = '' THEN
    fn_url := 'https://fpgxdtwmhsgikklsybql.supabase.co';
  END IF;
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_key := null;
  END;
  BEGIN
    PERFORM extensions.http_post(
      url := fn_url || '/functions/v1/seo-indexing-ping',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(service_key, '')
      ),
      body := jsonb_build_object('url', _url, 'action', _action, 'source', _source)::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- Auto-ping when a blog post is deployed
CREATE OR REPLACE FUNCTION public.tg_seo_blog_indexing_ping()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'deployed')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'deployed' AND (OLD.status IS DISTINCT FROM 'deployed')) THEN
    PERFORM public.trigger_indexing_ping(
      'https://www.precisedm.com/blog/' || NEW.slug,
      'URL_UPDATED',
      'blog:' || NEW.slug
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_seo_blog_indexing
  AFTER INSERT OR UPDATE ON public.seo_blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_seo_blog_indexing_ping();

REVOKE EXECUTE ON FUNCTION public.trigger_indexing_ping(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seo_blog_indexing_ping() FROM PUBLIC, anon, authenticated;
DELETE FROM public.subscriptions s
USING (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
    FROM public.subscriptions WHERE plan_type='trial'
  ) t WHERE t.rn > 1
) d
WHERE s.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_trial_per_user
ON public.subscriptions (user_id)
WHERE plan_type = 'trial';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS student_id_number text;

ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS student_id_number text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, user_type, custom_user_id, accepted_terms, college, student_id_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'student'),
    NEW.raw_user_meta_data->>'custom_user_id',
    COALESCE((NEW.raw_user_meta_data->>'accepted_terms')::boolean, false),
    NEW.raw_user_meta_data->>'college',
    NEW.raw_user_meta_data->>'student_id_number'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$function$;

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
INSERT INTO public.user_roles (user_id, role)
VALUES ('fcc38370-d404-4dae-a7ef-e84de5a24c95', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;