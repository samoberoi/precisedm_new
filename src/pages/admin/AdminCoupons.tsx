import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Ticket, ChevronLeft, Plus, Trash2, Loader2, Percent, CalendarClock } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  kind: string;
  percent_off: number;
  duration_months: number;
  assigned_email: string | null;
  max_redemptions: number;
  times_redeemed: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

interface Redemption {
  id: string;
  coupon_id: string;
  user_email: string;
  access_until: string | null;
  redeemed_at: string;
}

const randomCode = () =>
  "PDM-" + Math.random().toString(36).slice(2, 8).toUpperCase();

const AdminCoupons = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const [code, setCode] = useState(randomCode());
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"free_access" | "percent_discount">("free_access");
  const [percentOff, setPercentOff] = useState("100");
  const [months, setMonths] = useState("6");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [applyNow, setApplyNow] = useState(true);

  const call = useCallback(async (action: string, method: "GET" | "POST", body?: unknown) => {
    const { data: { session } } = await supabase.auth.getSession();
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/coupons?action=${action}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call("list", "GET");
      setCoupons(data.coupons || []);
      setRedemptions(data.redemptions || []);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    const guard = async () => {
      if (!user) { navigate("/login", { replace: true }); return; }
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) { navigate("/home", { replace: true }); return; }
      setChecking(false);
      load();
    };
    guard();
  }, [user, navigate, load]);

  const createCoupon = async () => {
    if (!code.trim()) { toast({ title: "Enter a coupon code", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = await call("create", "POST", {
        code,
        description,
        kind,
        percent_off: Number(percentOff),
        duration_months: Number(months),
        assigned_email: assignedEmail || null,
        max_redemptions: Number(maxRedemptions),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        apply_now: applyNow,
      });
      toast({
        title: "Coupon created",
        description: data.applied
          ? `Applied to ${assignedEmail} — access is live now.`
          : "Share the code with your user.",
      });
      setCode(randomCode());
      setDescription("");
      setAssignedEmail("");
      load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    await call("toggle", "POST", { id: c.id, active: !c.active });
    load();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await call("delete", "POST", { id: c.id });
    toast({ title: "Coupon deleted" });
    load();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Ticket className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
        </div>

        {/* Create */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm mb-8">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Create a coupon
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Coupon code</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-11 rounded-xl uppercase" />
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setCode(randomCode())}>New</Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Coupon type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_access">Free access for X months</SelectItem>
                  <SelectItem value="percent_discount">Percentage discount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "free_access" ? (
              <div>
                <Label className="text-xs flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Free months</Label>
                <Input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} className="h-11 rounded-xl" />
              </div>
            ) : (
              <div>
                <Label className="text-xs flex items-center gap-1"><Percent className="h-3 w-3" /> Discount %</Label>
                <Input type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            <div>
              <Label className="text-xs">Assign to a specific user (email, optional)</Label>
              <Input value={assignedEmail} onChange={(e) => setAssignedEmail(e.target.value)} placeholder="person@example.com" className="h-11 rounded-xl" />
            </div>

            <div>
              <Label className="text-xs">Max redemptions</Label>
              <Input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} disabled={!!assignedEmail} className="h-11 rounded-xl" />
            </div>

            <div>
              <Label className="text-xs">Expires on (optional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-11 rounded-xl" />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs">Note (internal)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. VIP clinician, 6 months complimentary" className="h-11 rounded-xl" />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Activate immediately for this user</p>
                <p className="text-xs text-muted-foreground">They get full access on next login — no code entry, no payment prompt.</p>
              </div>
              <Switch checked={applyNow} onCheckedChange={setApplyNow} disabled={!assignedEmail || kind !== "free_access"} />
            </div>
          </div>

          <Button onClick={createCoupon} disabled={saving} className="mt-4 h-12 w-full rounded-2xl gradient-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create coupon"}
          </Button>
        </div>

        {/* List */}
        <h2 className="text-sm font-bold text-foreground mb-3">All coupons</h2>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        ) : (
          <div className="space-y-3">
            {coupons.map((c) => {
              const used = redemptions.filter((r) => r.coupon_id === c.id);
              return (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-foreground">{c.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.kind === "free_access"
                          ? `${c.duration_months} month${c.duration_months > 1 ? "s" : ""} free access`
                          : `${c.percent_off}% discount`}
                        {c.assigned_email ? ` · ${c.assigned_email}` : " · anyone"}
                        {" · "}{c.times_redeemed}/{c.max_redemptions} used
                        {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                      </p>
                      {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                      {used.map((r) => (
                        <p key={r.id} className="text-xs text-primary mt-1">
                          Redeemed by {r.user_email}
                          {r.access_until ? ` · access until ${new Date(r.access_until).toLocaleDateString()}` : ""}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={c.active} onCheckedChange={() => toggle(c)} />
                      <Button variant="ghost" size="icon" onClick={() => remove(c)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminCoupons;
