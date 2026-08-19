import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Fingerprint, Loader2, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  authenticateWithBiometrics,
  isBiometricLoginEnabled,
  isNativeApp,
  restoreNativeSession,
} from "@/lib/native-auth";

const NativeAuthGate = ({ children }: { children: React.ReactNode }) => {
  const { loading, session, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(isNativeApp());
  const [checking, setChecking] = useState(isNativeApp());
  const [message, setMessage] = useState("");
  const backgroundedAt = useRef<number | null>(null);
  const authenticating = useRef(false);

  const unlock = useCallback(async () => {
    if (!isNativeApp() || loading || authenticating.current) return;
    authenticating.current = true;
    setChecking(true);
    setMessage("");

    try {
      const enabled = await isBiometricLoginEnabled();
      if (!enabled) {
        if (session) {
          const { enableBiometricLogin } = await import("@/lib/native-auth");
          await enableBiometricLogin(session);
        }
        setLocked(false);
        return;
      }

      await authenticateWithBiometrics();
      if (!user) {
        const restored = await restoreNativeSession();
        if (!restored) throw new Error("Your secure login has expired. Sign in with an email code.");
      }
      setLocked(false);
    } catch (error) {
      setLocked(true);
      setMessage(error instanceof Error ? error.message : "Authentication was not completed.");
    } finally {
      setChecking(false);
      authenticating.current = false;
    }
  }, [loading, session, user]);

  useEffect(() => {
    if (!loading) void unlock();
  }, [loading, unlock]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let removed = false;
    let listener: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }

      const awayFor = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (awayFor >= 5_000) {
        setLocked(true);
        void unlock();
      }
    }).then((handle) => {
      if (removed) void handle.remove();
      else listener = handle;
    });

    return () => {
      removed = true;
      if (listener) void listener.remove();
    };
  }, [unlock]);

  if (!isNativeApp() || !locked) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-8">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card shadow-sm">
          <Fingerprint className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-foreground">Unlock PreciseDM</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {message || "Confirm with Face ID, Touch ID, or fingerprint."}
        </p>
        <Button onClick={() => void unlock()} disabled={checking} className="mt-7 h-12 w-full rounded-2xl font-bold gradient-primary">
          {checking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</> : <><Fingerprint className="mr-2 h-4 w-4" /> Unlock</>}
        </Button>
        <Button
          variant="ghost"
          className="mt-2 w-full rounded-2xl"
          onClick={() => {
            void signOut();
            setLocked(false);
            navigate("/login", { replace: true });
          }}
        >
          <LogIn className="mr-2 h-4 w-4" /> Use email code instead
        </Button>
      </div>
    </main>
  );
};

export default NativeAuthGate;