import sharp from "sharp";
import fs from "node:fs/promises";

const logo = "assets/logo.png";
const background = { r: 234, g: 242, b: 255, alpha: 1 };
async function icon(size, destination, padding = 0.1) {
  const inset = Math.round(size * padding);
  const owl = await sharp(logo)
    .resize(size - 2 * inset, size - 2 * inset, { fit: "contain" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: owl, left: inset, top: inset }])
    .png()
    .toFile(destination);
}
await fs.mkdir("public", { recursive: true });
await icon(192, "public/icon-192.png");
await icon(512, "public/icon-512.png");
await icon(
  1024,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
  0.08,
);
console.log("Generated web and iOS icons from assets/logo.png.");
