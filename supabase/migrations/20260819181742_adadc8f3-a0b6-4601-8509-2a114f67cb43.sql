ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check
  CHECK (plan_type = ANY (ARRAY['monthly'::text,'yearly'::text,'trial'::text,'coupon'::text,'student_monthly'::text,'student_yearly'::text]));

DO $$
DECLARE
  v_user uuid;
  v_coupon uuid;
  v_sub uuid;
  v_until timestamptz := now() + interval '6 months';
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = 'tedlakes@aol.com' LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'user tedlakes@aol.com not found';
  END IF;

  INSERT INTO public.coupons (code, description, kind, percent_off, duration_months, assigned_email, assigned_user_id, max_redemptions, times_redeemed, active)
  VALUES ('PDM-TED6M', 'Complimentary 6 months full access', 'free_access', 100, 6, 'tedlakes@aol.com', v_user, 1, 1, true)
  ON CONFLICT (code) DO UPDATE SET active = true
  RETURNING id INTO v_coupon;

  INSERT INTO public.subscriptions (user_id, plan_type, status, start_date, next_billing_date, paypal_subscription_id)
  VALUES (v_user, 'coupon', 'active', now(), v_until, 'COUPON-PDM-TED6M')
  RETURNING id INTO v_sub;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, subscription_id, access_until)
  VALUES (v_coupon, v_user, v_sub, v_until);
END $$;