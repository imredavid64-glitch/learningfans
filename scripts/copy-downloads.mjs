import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const root = join(__dirname, "..");
const out = join(root, "public", "downloads");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const patterns = [
  { dir: join(root, "android", "app", "build", "outputs", "apk", "release"), match: /\.apk$/, copy: (f) => `learningfans-android.apk` },
  { dir: join(root, "release"), match: /\.(dmg|zip|exe|AppImage|deb)$/, copy: (f) => `learningfans-${f.replace(/^learningfans-/, "")}` },
];

let copied = 0;
for (const { dir, match, copy } of patterns) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (match.test(f)) {
      copyFileSync(join(dir, f), join(out, copy(f)));
      console.log(`Copied ${f} -> public/downloads/${copy(f)}`);
      copied++;
    }
  }
}

if (copied === 0) {
  console.log("No build artifacts found. Run the build commands first:\n  npm run mobile:android:apk  (Android)\n  npm run desktop:build       (macOS)\n  npm run desktop:build:win   (Windows)\n  npm run desktop:build:linux (Linux)");
}
