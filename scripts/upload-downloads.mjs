import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const root = join(__dirname, "..");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xhximqrchwwwwwsysgdo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const BUCKET = "downloads";

async function uploadFile(localPath, objectPath, contentType) {
  const data = readFileSync(localPath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
    },
    body: data,
  });
  if (!res.ok) {
    console.error(`Upload failed for ${objectPath}: ${res.status} ${await res.text()}`);
    return false;
  }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  console.log(`Uploaded ${objectPath} -> ${publicUrl}`);
  return true;
}

const jobs = [];

const macDmg = join(root, "release", "learningfans-0.1.0-mac-arm64.dmg");
if (existsSync(macDmg)) {
  jobs.push(uploadFile(macDmg, "learningfans-mac.dmg", "application/x-apple-diskimage"));
}

const releaseDir = join(root, "release");
if (existsSync(releaseDir)) {
  for (const f of readdirSync(releaseDir)) {
    if (/\.(exe|AppImage|deb|zip)$/.test(f)) {
      const mime = f.endsWith(".exe")
        ? "application/x-msdownload"
        : f.endsWith(".AppImage")
          ? "application/x-executable"
          : f.endsWith(".deb")
            ? "application/vnd.debian.binary-package"
            : "application/zip";
      jobs.push(uploadFile(join(releaseDir, f), f.replace(/^learningfans-0\.1\.0-/, "learningfans-"), mime));
    }
  }
}

const apk = join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
if (existsSync(apk)) {
  jobs.push(uploadFile(apk, "learningfans-android.apk", "application/vnd.android.package-archive"));
}

if (jobs.length === 0) {
  console.log("No build artifacts found. Build them first:");
  console.log("  npm run desktop:build:mac");
  console.log("  npm run mobile:android:apk");
  console.log("  npm run desktop:build:win");
  console.log("  npm run desktop:build:linux");
  process.exit(0);
}

await Promise.all(jobs);
