import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET = list users with count + stats
    if (req.method === "GET") {
      // If action=subscriptions, return all subscription records with user details
      if (action === "subscriptions") {
        const { data: allSubs, error } = await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name, email, user_type");

        const enriched = (allSubs || []).map((s: any) => {
          const profile = profiles?.find((p: any) => p.user_id === s.user_id);
          return {
            ...s,
            user_name: profile?.full_name || "Unknown",
            user_email: profile?.email || "",
            user_type: profile?.user_type || "student",
          };
        });

        return new Response(
          JSON.stringify({ subscriptions: enriched, total: enriched.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If action=submissions, return form submission data
      if (action === "submissions") {
        const { data: submissions, error } = await supabaseAdmin
          .from("form_submissions")
          .select("id, user_id, form_type, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get profiles for user names
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name");

        const enriched = (submissions || []).map((s: any) => {
          const profile = profiles?.find((p: any) => p.user_id === s.user_id);
          return {
            id: s.id,
            user_id: s.user_id,
            form_type: s.form_type,
            created_at: s.created_at,
            user_name: profile?.full_name || "Unknown",
          };
        });

        // Compute stats
        const stats: Record<string, number> = {};
        for (const s of submissions || []) {
          stats[s.form_type] = (stats[s.form_type] || 0) + 1;
        }

        return new Response(
          JSON.stringify({ submissions: enriched, stats, total: (submissions || []).length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Default: list users (paginate — listUsers caps per page)
      const allAuthUsers: any[] = [];
      for (let page = 1; page <= 40; page++) {
        const { data: pageData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        const batch = pageData?.users || [];
        allAuthUsers.push(...batch);
        if (batch.length < 1000) break;
      }

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("*");

      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      const adminUserIds = new Set(
        (roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );

      // Get subscriptions up-front so each user row can carry its plan dates
      const { data: allSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("*");

      const now = new Date();
      const DAY = 24 * 60 * 60 * 1000;

      // Most relevant subscription per user: active & not expired wins, then latest created
      const rank = (s: any) => {
        const notExpired = !s.next_billing_date || new Date(s.next_billing_date) > now;
        if (s.status === "active" && notExpired) return 3;
        if (s.status === "active") return 2;
        return 1;
      };
      const bestPerUser = new Map<string, any>();
      for (const s of allSubs || []) {
        const existing = bestPerUser.get(s.user_id);
        if (
          !existing ||
          rank(s) > rank(existing) ||
          (rank(s) === rank(existing) && new Date(s.created_at) > new Date(existing.created_at))
        ) {
          bestPerUser.set(s.user_id, s);
        }
      }

      const users = allAuthUsers.map((u: any) => {
        const profile = profiles?.find((p: any) => p.user_id === u.id);
        const isAdmin = adminUserIds.has(u.id);
        const sub = bestPerUser.get(u.id) || null;
        const renewal = sub?.next_billing_date ? new Date(sub.next_billing_date) : null;
        const isCurrent = !!sub && sub.status === "active" && (!renewal || renewal > now);
        return {
          id: u.id,
          email: u.email,
          full_name: profile?.full_name || "",
          user_type: isAdmin ? "admin" : (profile?.user_type || "student"),
          custom_user_id: profile?.custom_user_id || "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          plan_type: sub?.plan_type || null,
          subscription_status: sub ? (isCurrent ? "active" : (renewal && renewal <= now ? "expired" : sub.status)) : "none",
          start_date: sub?.start_date || null,
          next_billing_date: sub?.next_billing_date || null,
          days_remaining: renewal ? Math.ceil((renewal.getTime() - now.getTime()) / DAY) : null,
          paypal_subscription_id: sub?.paypal_subscription_id || null,
        };
      });

      // Also get submission counts
      const { data: submissions } = await supabaseAdmin
        .from("form_submissions")
        .select("form_type");

      const formStats: Record<string, number> = {};
      for (const s of submissions || []) {
        formStats[s.form_type] = (formStats[s.form_type] || 0) + 1;
      }

      const uniqueActiveSubs = Array.from(bestPerUser.values()).filter(
        (s: any) => s.status === "active" && s.next_billing_date && new Date(s.next_billing_date) > now
      );

      const subscribedUserIds = new Set(uniqueActiveSubs.map((s: any) => s.user_id));
      const monthlySubs = uniqueActiveSubs.filter((s: any) => s.plan_type === "monthly");
      const yearlySubs = uniqueActiveSubs.filter((s: any) => s.plan_type === "yearly");

      const withProfile = (s: any) => {
        const profile = profiles?.find((p: any) => p.user_id === s.user_id);
        return {
          ...s,
          user_name: profile?.full_name || profile?.email || "Unknown",
          user_email: profile?.email || "",
        };
      };
      const byDate = (a: any, b: any) =>
        new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();

      const inDays = (n: number) =>
        uniqueActiveSubs.filter((s: any) => new Date(s.next_billing_date) <= new Date(now.getTime() + n * DAY));

      const upcomingRenewals = inDays(15).map(withProfile).sort(byDate);
      const renewals30 = inDays(30).map(withProfile).sort(byDate);
      const expiredSubs = Array.from(bestPerUser.values())
        .filter((s: any) => s.next_billing_date && new Date(s.next_billing_date) <= now)
        .map(withProfile)
        .sort((a: any, b: any) => new Date(b.next_billing_date).getTime() - new Date(a.next_billing_date).getTime());

      return new Response(
        JSON.stringify({ 
          users, 
          total: users.length, 
          formStats,
          totalSubmissions: (submissions || []).length,
          subscriptionStats: {
            totalSubscribed: subscribedUserIds.size,
            totalUnsubscribed: users.length - subscribedUserIds.size,
            monthly: monthlySubs.length,
            yearly: yearlySubs.length,
            upcomingRenewals,
            renewals30,
            renewalsNext7: inDays(7).length,
            renewalsNext30: renewals30.length,
            expired: expiredSubs.length,
            expiredSubs: expiredSubs.slice(0, 25),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST = create user (optionally apply a coupon + send invite email)
    if (req.method === "POST") {
      const body = await req.json();
      const { email, password, full_name, user_type, custom_user_id, coupon_code, send_invite } = body;

      if (!email || !full_name) {
        return new Response(
          JSON.stringify({ error: "Email and full name are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const isAdmin = user_type === "admin";
      const actualUserType = isAdmin ? "student" : (user_type || "student");

      // Sign-in is OTP based — a password is optional, generate one if not supplied
      const pwd = password && String(password).length >= 8
        ? password
        : crypto.randomUUID() + "Aa1!";

      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: pwd,
          email_confirm: true,
          user_metadata: {
            full_name,
            user_type: actualUserType,
            custom_user_id: custom_user_id || null,
            accepted_terms: true,
          },
        });

      if (createError) throw createError;

      const newUserId = newUser.user.id;

      // If admin type selected, add admin role
      if (isAdmin) {
        await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "admin" });
      }

      // ---------- Optional: apply a coupon to the brand-new account ----------
      let couponResult: {
        code: string;
        kind: string;
        percent_off: number;
        months: number;
        access_until: string | null;
        applied: boolean;
      } | null = null;

      const wantedCode = coupon_code ? String(coupon_code).trim().toUpperCase() : "";
      if (wantedCode) {
        const { data: coupon } = await supabaseAdmin
          .from("coupons")
          .select("*")
          .ilike("code", wantedCode)
          .maybeSingle();

        if (!coupon || !coupon.active) {
          couponResult = { code: wantedCode, kind: "unknown", percent_off: 0, months: 0, access_until: null, applied: false };
        } else if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          couponResult = { code: coupon.code, kind: coupon.kind, percent_off: coupon.percent_off, months: coupon.duration_months, access_until: null, applied: false };
        } else if (coupon.times_redeemed >= coupon.max_redemptions) {
          couponResult = { code: coupon.code, kind: coupon.kind, percent_off: coupon.percent_off, months: coupon.duration_months, access_until: null, applied: false };
        } else if (coupon.kind === "free_access" || coupon.percent_off >= 100) {
          const now = new Date();
          const accessUntil = new Date(now.getTime());
          accessUntil.setMonth(accessUntil.getMonth() + Math.max(1, coupon.duration_months || 1));

          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .insert({
              user_id: newUserId,
              plan_type: "coupon",
              status: "active",
              start_date: now.toISOString(),
              next_billing_date: accessUntil.toISOString(),
              paypal_subscription_id: `COUPON-${coupon.code}`,
            })
            .select()
            .single();

          await supabaseAdmin.from("coupon_redemptions").insert({
            coupon_id: coupon.id,
            user_id: newUserId,
            subscription_id: sub?.id ?? null,
            access_until: accessUntil.toISOString(),
          });
          await supabaseAdmin
            .from("coupons")
            .update({
              times_redeemed: (coupon.times_redeemed || 0) + 1,
              assigned_user_id: coupon.assigned_email ? newUserId : coupon.assigned_user_id,
            })
            .eq("id", coupon.id);

          couponResult = {
            code: coupon.code,
            kind: coupon.kind,
            percent_off: coupon.percent_off,
            months: coupon.duration_months,
            access_until: accessUntil.toISOString(),
            applied: true,
          };
        } else {
          // Percentage discount — no access granted, the user enters the code at checkout
          couponResult = {
            code: coupon.code,
            kind: coupon.kind,
            percent_off: coupon.percent_off,
            months: coupon.duration_months,
            access_until: null,
            applied: true,
          };
        }
      }

      // ---------- Invite email ----------
      let emailSent = false;
      let emailError: string | null = null;
      if (send_invite !== false) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          emailError = "Email service is not configured";
        } else {
          const appUrl = "https://www.precisedm.com";
          const firstName = String(full_name).split(" ")[0];

          let perk = "";
          if (couponResult?.applied && couponResult.access_until) {
            const until = new Date(couponResult.access_until).toLocaleDateString("en-US", {
              day: "numeric", month: "long", year: "numeric",
            });
            perk = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
                Good news — a complimentary <strong>${couponResult.months}-month</strong> access pass has already been applied to your account.
                You have full access until <strong>${until}</strong>, with nothing to pay and no code to enter.
              </p>`;
          } else if (couponResult?.applied && couponResult.kind === "percent_discount") {
            perk = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
                Use coupon code <strong style="letter-spacing:1px">${couponResult.code}</strong> at checkout for
                <strong>${couponResult.percent_off}% off</strong> your subscription.
              </p>`;
          }

          const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">You've been invited to PreciseDM</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
      Hi ${firstName}, an administrator has created a PreciseDM account for you using <strong>${email}</strong>.
    </p>
    ${perk}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">
      There's no password to remember — just open PreciseDM, enter your email, and we'll send you a one-time code to sign in.
    </p>
    <p style="margin:0 0 24px">
      <a href="${appUrl}/login" style="display:inline-block;background:#22b3e8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px">Sign in to PreciseDM</a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8">
      PreciseDM — precision insulin dosing support for clinicians and students.
    </p>
  </div>
</div>`;

          try {
            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "PreciseDM <no-reply@hyperrevamp.com>",
                to: [email],
                subject: couponResult?.applied && couponResult.access_until
                  ? `You've been invited to PreciseDM — ${couponResult.months} months on us`
                  : "You've been invited to PreciseDM",
                html,
              }),
            });
            if (resp.ok) emailSent = true;
            else emailError = (await resp.text()).slice(0, 300);
          } catch (e) {
            emailError = (e as Error).message;
          }
        }
      }

      return new Response(
        JSON.stringify({
          message: "User created",
          user_id: newUserId,
          coupon: couponResult,
          email_sent: emailSent,
          email_error: emailError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
