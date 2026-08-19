/**
 * Configures the native iOS/Android projects after `npx cap add` / `npx cap sync`.
 * Idempotent: safe to run as many times as you like.
 *
 * - iOS: adds NSFaceIDUsageDescription (without it iOS silently downgrades to passcode)
 * - Android: adds USE_BIOMETRIC + USE_FINGERPRINT permissions
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FACE_ID_REASON =
  "PreciseDM uses Face ID to securely unlock your account after your first email verification.";

/* ---------------------------------- iOS ---------------------------------- */
const plistPath = "ios/App/App/Info.plist";
if (existsSync(plistPath)) {
  let plist = readFileSync(plistPath, "utf8");
  let changed = false;

  if (!plist.includes("NSFaceIDUsageDescription")) {
    // Insert right before the final closing </dict> of the root dictionary.
    const idx = plist.lastIndexOf("</dict>");
    plist =
      plist.slice(0, idx) +
      `\t<key>NSFaceIDUsageDescription</key>\n\t<string>${FACE_ID_REASON}</string>\n` +
      plist.slice(idx);
    changed = true;
  } else {
    // Keep the reason string in sync if it was previously added with other text.
    const current = plist.match(
      /<key>NSFaceIDUsageDescription<\/key>\s*<string>([\s\S]*?)<\/string>/,
    );
    if (current && current[1] !== FACE_ID_REASON) {
      plist = plist.replace(
        /(<key>NSFaceIDUsageDescription<\/key>\s*<string>)[\s\S]*?(<\/string>)/,
        `$1${FACE_ID_REASON}$2`,
      );
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(plistPath, plist);
    console.log("✓ iOS: NSFaceIDUsageDescription configured (Face ID enabled).");
  } else {
    console.log("✓ iOS: Face ID usage description already present.");
  }
} else {
  throw new Error("iOS project not found; Face ID configuration was not applied.");
}

/* -------------------------------- Android -------------------------------- */
const manifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, "utf8");
  const permissions = [
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
  ].filter((p) => !manifest.includes(p));

  if (permissions.length) {
    manifest = manifest.replace(
      "<application",
      `${permissions
        .map((p) => `<uses-permission android:name="${p}" />`)
        .join("\n    ")}\n\n    <application`,
    );
    writeFileSync(manifestPath, manifest);
    console.log(`✓ Android: added ${permissions.length} biometric permission(s).`);
  } else {
    console.log("✓ Android: biometric permissions already present.");
  }
} else {
  throw new Error("Android project not found; biometric permissions were not applied.");
}

// Fail the native setup instead of printing a misleading success message.
const configuredPlist = readFileSync(plistPath, "utf8");
const configuredManifest = readFileSync(manifestPath, "utf8");
if (!configuredPlist.includes("<key>NSFaceIDUsageDescription</key>")) {
  throw new Error("NSFaceIDUsageDescription is missing after native configuration.");
}
for (const permission of ["android.permission.USE_BIOMETRIC", "android.permission.USE_FINGERPRINT"]) {
  if (!configuredManifest.includes(permission)) {
    throw new Error(`${permission} is missing after native configuration.`);
  }
}
console.log("✓ Native biometric configuration verified.");
