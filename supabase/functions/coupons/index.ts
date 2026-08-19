import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const isAdmin = !!isAdminData;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ---------- USER: redeem a coupon code ----------
    if (req.method === "POST" && action === "redeem") {
      const { code } = await req.json();
      if (!code || typeof code !== "string") return json({ error: "Coupon code required" }, 400);
      const normalized = code.trim().toUpperCase();

      const { data: coupon } = await admin
        .from("coupons")
        .select("*")
        .ilike("code", normalized)
        .maybeSingle();

      if (!coupon || !coupon.active) return json({ error: "This coupon code is not valid." }, 400);
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
        return json({ error: "This coupon has expired." }, 400);
      if (coupon.times_redeemed >= coupon.max_redemptions)
        return json({ error: "This coupon has already been fully redeemed." }, 400);

      const assignedEmail = (coupon.assigned_email || "").trim().toLowerCase();
      if (assignedEmail && assignedEmail !== (user.email || "").toLowerCase())
        return json({ error: "This coupon is assigned to a different account." }, 403);
      if (coupon.assigned_user_id && coupon.assigned_user_id !== user.id)
        return json({ error: "This coupon is assigned to a different account." }, 403);

      const { data: existing } = await admin
        .from("coupon_redemptions")
        .select("id")
        .eq("coupon_id", coupon.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) return json({ error: "You have already redeemed this coupon." }, 400);

      if (coupon.kind !== "free_access" && coupon.percent_off < 100) {
        // Percentage discounts are informational for PayPal checkout, no access granted here.
        return json({
          ok: true,
          discount_only: true,
          percent_off: coupon.percent_off,
          message: `Coupon applied: ${coupon.percent_off}% off.`,
        });
      }

      const now = new Date();
      const accessUntil = addMonths(now, Math.max(1, coupon.duration_months || 1));

      const { data: sub, error: subErr } = await admin
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_type: `coupon_${coupon.duration_months}m`,
          status: "active",
          start_date: now.toISOString(),
          next_billing_date: accessUntil.toISOString(),
          paypal_subscription_id: `COUPON-${coupon.code}`,
        })
        .select()
        .single();
      if (subErr) throw subErr;

      await admin.from("coupon_redemptions").insert({
        coupon_id: coupon.id,
        user_id: user.id,
        subscription_id: sub.id,
        access_until: accessUntil.toISOString(),
      });
      await admin
        .from("coupons")
        .update({ times_redeemed: coupon.times_redeemed + 1 })
        .eq("id", coupon.id);

      return json({ ok: true, access_until: accessUntil.toISOString(), months: coupon.duration_months });
    }

    // Everything below is admin-only
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // ---------- ADMIN: list ----------
    if (req.method === "GET" && (action === "list" || !action)) {
      const { data: coupons } = await admin
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: redemptions } = await admin
        .from("coupon_redemptions")
        .select("*")
        .order("redeemed_at", { ascending: false });

      const userIds = [...new Set((redemptions || []).map((r) => r.user_id))];
      let emailById: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);
        emailById = Object.fromEntries(
          (profiles || []).map((p) => [p.user_id, p.email || p.full_name || ""])
        );
      }

      return json({
        coupons: coupons || [],
        redemptions: (redemptions || []).map((r) => ({ ...r, user_email: emailById[r.user_id] || r.user_id })),
      });
    }

    // ---------- ADMIN: create ----------
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return json({ error: "Code is required" }, 400);

      const kind = body.kind === "percent_discount" ? "percent_discount" : "free_access";
      const percentOff = kind === "free_access" ? 100 : Math.min(100, Math.max(1, Number(body.percent_off) || 10));
      const durationMonths = Math.max(1, Number(body.duration_months) || 1);
      const assignedEmail = body.assigned_email ? String(body.assigned_email).trim().toLowerCase() : null;

      let assignedUserId: string | null = null;
      if (assignedEmail) {
        const { data: prof } = await admin
          .from("profiles")
          .select("user_id")
          .ilike("email", assignedEmail)
          .maybeSingle();
        assignedUserId = prof?.user_id ?? null;
      }

      const { data: coupon, error } = await admin
        .from("coupons")
        .insert({
          code,
          description: body.description || null,
          kind,
          percent_off: percentOff,
          duration_months: durationMonths,
          assigned_email: assignedEmail,
          assigned_user_id: assignedUserId,
          max_redemptions: assignedEmail ? 1 : Math.max(1, Number(body.max_redemptions) || 1),
          expires_at: body.expires_at || null,
          active: true,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505")
          return json({ error: "That coupon code already exists." }, 400);
        throw error;
      }

      // Optionally apply immediately to the assigned user (no login prompt needed)
      let applied = false;
      if (body.apply_now && assignedUserId && kind === "free_access") {
        const now = new Date();
        const accessUntil = addMonths(now, durationMonths);
        const { data: sub } = await admin
          .from("subscriptions")
          .insert({
            user_id: assignedUserId,
            plan_type: `coupon_${durationMonths}m`,
            status: "active",
            start_date: now.toISOString(),
            next_billing_date: accessUntil.toISOString(),
            paypal_subscription_id: `COUPON-${code}`,
          })
          .select()
          .single();
        await admin.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          user_id: assignedUserId,
          subscription_id: sub?.id ?? null,
          access_until: accessUntil.toISOString(),
        });
        await admin.from("coupons").update({ times_redeemed: 1 }).eq("id", coupon.id);
        applied = true;
      }

      return json({ ok: true, coupon, applied });
    }

    // ---------- ADMIN: toggle active ----------
    if (req.method === "POST" && action === "toggle") {
      const { id, active } = await req.json();
      await admin.from("coupons").update({ active: !!active }).eq("id", id);
      return json({ ok: true });
    }

    // ---------- ADMIN: delete ----------
    if (req.method === "POST" && action === "delete") {
      const { id } = await req.json();
      await admin.from("coupons").delete().eq("id", id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("coupons error:", err);
    return json({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});
