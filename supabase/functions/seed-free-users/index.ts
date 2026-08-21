import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PEOPLE = [
  { email: "sharonsteener@yahoo.com", full_name: "Dr Sharon Steen", user_type: "practitioner", code: "PDM-SHARON6M" },
  { email: "bbgolant@yahoo.com", full_name: "Barb Golant, RN", user_type: "practitioner", code: "PDM-BARB6M" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const out: any[] = [];

  for (const person of PEOPLE) {
    try {
      // find existing user
      let userId: string | null = null;
      for (let page = 1; page <= 40; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const found = (data?.users || []).find(
          (u: any) => (u.email || "").toLowerCase() === person.email
        );
        if (found) { userId = found.id; break; }
        if ((data?.users || []).length < 1000) break;
      }

      if (!userId) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: person.email,
          password: crypto.randomUUID() + "Aa1!",
          email_confirm: true,
          user_metadata: {
            full_name: person.full_name,
            user_type: person.user_type,
            accepted_terms: true,
          },
        });
        if (error) throw error;
        userId = created.user.id;
      }

      // ensure profile
      const { data: prof } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      if (!prof) {
        await admin.from("profiles").insert({
          user_id: userId,
          full_name: person.full_name,
          email: person.email,
          user_type: person.user_type,
          accepted_terms: true,
        });
      }

      // coupon
      const now = new Date();
      const accessUntil = new Date(now.getTime());
      accessUntil.setMonth(accessUntil.getMonth() + 6);

      let { data: coupon } = await admin.from("coupons").select("*").ilike("code", person.code).maybeSingle();
      if (!coupon) {
        const { data: c, error } = await admin.from("coupons").insert({
          code: person.code,
          description: `6 months complimentary access — ${person.full_name}`,
          kind: "free_access",
          percent_off: 100,
          duration_months: 6,
          assigned_email: person.email,
          assigned_user_id: userId,
          max_redemptions: 1,
          active: true,
        }).select().single();
        if (error) throw error;
        coupon = c;
      }

      // subscription
      const { data: sub, error: subErr } = await admin.from("subscriptions").insert({
        user_id: userId,
        plan_type: "coupon",
        status: "active",
        start_date: now.toISOString(),
        next_billing_date: accessUntil.toISOString(),
        paypal_subscription_id: `COUPON-${person.code}`,
      }).select().single();
      if (subErr) throw subErr;

      const { data: existingRedemption } = await admin
        .from("coupon_redemptions").select("id").eq("coupon_id", coupon.id).eq("user_id", userId).maybeSingle();
      if (!existingRedemption) {
        await admin.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          user_id: userId,
          subscription_id: sub.id,
          access_until: accessUntil.toISOString(),
        });
        await admin.from("coupons").update({
          times_redeemed: (coupon.times_redeemed || 0) + 1,
          assigned_user_id: userId,
        }).eq("id", coupon.id);
      }

      // invite email
      let emailSent = false;
      let emailError: string | null = null;
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const firstName = person.full_name.replace(/^Dr\s+/i, "").split(" ")[0];
        const until = accessUntil.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
        const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">Welcome to PreciseDM</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
      Hi ${firstName}, a PreciseDM account has been created for you using <strong>${person.email}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
      A complimentary <strong>6-month</strong> access pass has already been applied — full access until <strong>${until}</strong>, nothing to pay and no code to enter.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
      There's no password to remember — just open PreciseDM, enter your email, and we'll send you a one-time code to sign in.
    </p>
    <p style="margin:0 0 24px">
      <a href="https://www.precisedm.com/login" style="display:inline-block;background:#22b3e8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px">Sign in to PreciseDM</a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8">PreciseDM — precision insulin dosing support for clinicians and students.</p>
  </div>
</div>`;
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "PreciseDM <no-reply@hyperrevamp.com>",
              to: [person.email],
              subject: "Welcome to PreciseDM — 6 months on us",
              html,
            }),
          });
          if (resp.ok) emailSent = true;
          else emailError = (await resp.text()).slice(0, 300);
        } catch (e) {
          emailError = (e as Error).message;
        }
      } else {
        emailError = "RESEND_API_KEY not configured";
      }

      out.push({
        email: person.email,
        user_id: userId,
        coupon: person.code,
        access_until: accessUntil.toISOString(),
        email_sent: emailSent,
        email_error: emailError,
      });
    } catch (e) {
      out.push({ email: person.email, error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ results: out }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
