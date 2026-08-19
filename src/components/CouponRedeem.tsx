import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Ticket, Loader2 } from "lucide-react";

interface CouponRedeemProps {
  onRedeemed?: () => void;
}

const CouponRedeem = ({ onRedeemed }: CouponRedeemProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const redeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Please sign in first", variant: "destructive" });
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/coupons?action=redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: code.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Could not apply coupon", variant: "destructive" });
        return;
      }
      if (data.discount_only) {
        toast({ title: data.message, description: "Mention this at checkout to get your discount." });
      } else {
        toast({
          title: "Coupon applied",
          description: `Full access unlocked until ${new Date(data.access_until).toLocaleDateString()}.`,
        });
      }
      setCode("");
      onRedeemed?.();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Have a coupon code?</h3>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          className="h-11 rounded-xl uppercase tracking-wide"
        />
        <Button
          onClick={redeem}
          disabled={loading || !code.trim()}
          className="h-11 rounded-xl px-5 font-bold gradient-primary text-primary-foreground"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
    </div>
  );
};

export default CouponRedeem;
