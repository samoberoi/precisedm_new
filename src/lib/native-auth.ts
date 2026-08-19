import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";
import { supabase } from "@/integrations/supabase/client";

const ONBOARDING_KEY = "precisedm_onboarding_complete";
const BIOMETRIC_KEY = "precisedm_biometric_enabled";
const SESSION_KEY = "native_session";

type StoredSession = {
  accessToken: string;
  refreshToken: string;
};

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function hasCompletedOnboarding() {
  if (!isNativeApp()) return true;
  const { value } = await Preferences.get({ key: ONBOARDING_KEY });
  return value === "true";
}

export async function markOnboardingComplete() {
  if (!isNativeApp()) return;
  await Preferences.set({ key: ONBOARDING_KEY, value: "true" });
}

export async function isBiometricLoginEnabled() {
  if (!isNativeApp()) return false;
  const { value } = await Preferences.get({ key: BIOMETRIC_KEY });
  return value === "true";
}

async function configureSecureStorage() {
  await SecureStorage.setKeyPrefix("precisedm_");
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenPasscodeSetThisDeviceOnly);
}

export async function saveNativeSession(session: Session) {
  if (!isNativeApp() || !(await isBiometricLoginEnabled())) return;
  await configureSecureStorage();
  await SecureStorage.set(SESSION_KEY, {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

export async function authenticateWithBiometrics(reason = "Unlock PreciseDM") {
  if (!isNativeApp()) return true;
  const availability = await BiometricAuth.checkBiometry();
  const hasBiometry = availability.isAvailable;
  if (!hasBiometry && !availability.deviceIsSecure) return false;

  // Prefer true biometrics (Face ID / fingerprint). Only fall back to the
  // device passcode when the device has no enrolled biometrics at all.
  await BiometricAuth.authenticate({
    reason,
    cancelTitle: "Use email code",
    allowDeviceCredential: !hasBiometry,
    iosFallbackTitle: hasBiometry ? "" : "Use device passcode",
    androidTitle: "Unlock PreciseDM",
    androidSubtitle: "Confirm your identity to continue",
    androidConfirmationRequired: false,
    androidBiometryStrength: hasBiometry ? undefined : undefined,
  });
  return true;
}

export async function enableBiometricLogin(session: Session) {
  if (!isNativeApp()) return false;
  await markOnboardingComplete();

  const available = await authenticateWithBiometrics("Enable Face ID or biometrics for PreciseDM");
  if (!available) return false;

  await Preferences.set({ key: BIOMETRIC_KEY, value: "true" });
  await saveNativeSession(session);
  return true;
}

export async function restoreNativeSession() {
  if (!isNativeApp() || !(await isBiometricLoginEnabled())) return null;
  await configureSecureStorage();
  const stored = await SecureStorage.get(SESSION_KEY, false);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;

  const candidate = stored as Record<string, unknown>;
  const accessToken = candidate.accessToken;
  const refreshToken = candidate.refreshToken;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data.session;
}

export async function clearNativeLogin() {
  if (!isNativeApp()) return;
  await configureSecureStorage();
  await Promise.allSettled([
    SecureStorage.remove(SESSION_KEY),
    Preferences.remove({ key: BIOMETRIC_KEY }),
  ]);
}