INSERT INTO public.user_roles (user_id, role)
VALUES ('fcc38370-d404-4dae-a7ef-e84de5a24c95', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;