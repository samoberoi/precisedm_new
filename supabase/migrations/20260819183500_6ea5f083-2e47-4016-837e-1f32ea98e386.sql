DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any accounts created while the trigger was missing
INSERT INTO public.profiles (user_id, full_name, email, user_type, custom_user_id, accepted_terms)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       u.email,
       COALESCE((u.raw_user_meta_data->>'user_type')::public.user_type, 'student'),
       u.raw_user_meta_data->>'custom_user_id',
       COALESCE((u.raw_user_meta_data->>'accepted_terms')::boolean, false)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'
WHERE r.id IS NULL;