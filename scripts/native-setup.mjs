/**
 * One-command native setup:
 *   npm run native
 *
 * Adds any missing platform, builds the web app, syncs Capacitor,
 * generates app icons + splash screens from /resources, and patches
 * Info.plist / AndroidManifest.xml (Face ID + biometric permissions).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

// Capacitor can generate the Xcode project on every supported host. Keeping
// both native projects in source control makes required privacy keys and
// permissions deterministic instead of depending on each developer's Mac.
if (!existsSync("ios")) run("npx cap add ios");
if (!existsSync("android")) run("npx cap add android");

run("npm run build");
run("npx cap sync");

// Icons + splash screens from resources/icon.png and resources/splash.png
const platforms = [existsSync("ios") && "ios", existsSync("android") && "android"].filter(Boolean);
if (platforms.length) {
  run(
    `npx @capacitor/assets generate ${platforms.map((p) => `--${p}`).join(" ")} --iconBackgroundColor "#38B6FF" --splashBackgroundColor "#38B6FF" --splashBackgroundColorDark "#0B1220"`,
  );
}

run("node scripts/configure-native.mjs");

console.log("\n✅ Native projects are ready. Open with `npx cap open ios` or `npx cap open android`.");
