import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0f7670"/>
  <g transform="translate(25,20)">
    <path d="M0 0 L0 50 L25 35 L50 50 L50 0 Z" fill="white" opacity="0.9"/>
    <path d="M0 0 L0 50 L25 35 L50 50 L50 0 Z" fill="white"/>
    <rect x="5" y="8" width="12" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
    <rect x="5" y="14" width="12" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
    <rect x="5" y="20" width="8" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
    <rect x="33" y="8" width="12" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
    <rect x="33" y="14" width="12" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
    <rect x="33" y="20" width="8" height="2" rx="1" fill="#0f7670" opacity="0.5"/>
  </g>
</svg>`;

writeFileSync(join(outDir, "icon.svg"), svgIcon);

const sizes = [192, 512];
for (const size of sizes) {
  const buf = await sharp(Buffer.from(svgIcon)).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, `icon-${size}x${size}.png`), buf);
  console.log(`Created ${size}x${size} PNG`);
}

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0f7670"/>
  <g transform="translate(32,25)">
    <path d="M0 0 L0 45 L18 32 L36 45 L36 0 Z" fill="white" opacity="0.9"/>
  </g>
</svg>`;

for (const size of sizes) {
  const buf = await sharp(Buffer.from(maskableSvg)).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, `maskable-icon-${size}x${size}.png`), buf);
  console.log(`Created maskable ${size}x${size} PNG`);
}

console.log("Done");
