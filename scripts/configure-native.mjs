import { existsSync, readFileSync, writeFileSync } from "node:fs";

const plistPath = "ios/App/App/Info.plist";
if (existsSync(plistPath)) {
  let plist = readFileSync(plistPath, "utf8");
  if (!plist.includes("NSFaceIDUsageDescription")) {
    plist = plist.replace(
      "</dict>",
      "\t<key>NSFaceIDUsageDescription</key>\n\t<string>PreciseDM uses Face ID to securely unlock your account after your first email verification.</string>\n</dict>",
    );
    writeFileSync(plistPath, plist);
    console.log("Configured iOS Face ID permission.");
  }
}

const manifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, "utf8");
  if (!manifest.includes("android.permission.USE_BIOMETRIC")) {
    manifest = manifest.replace(
      "<application",
      '<uses-permission android:name="android.permission.USE_BIOMETRIC" />\n\n    <application',
    );
    writeFileSync(manifestPath, manifest);
    console.log("Configured Android biometric permission.");
  }
}