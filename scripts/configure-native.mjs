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
  console.log("• iOS project not found — run `npx cap add ios` first.");
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
  console.log("• Android project not found — run `npx cap add android` first.");
}
