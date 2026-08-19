CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.last_login = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.tg_seo_blog_indexing_ping()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.trigger_indexing_ping(_url text, _action text, _source text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$
;
