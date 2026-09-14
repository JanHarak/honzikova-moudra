import fs from "node:fs/promises";
import path from "node:path";
export function mapRows(rows) {
  const seen = new Set(),
    texts = new Map(),
    report = { valid: [], errors: [], duplicates: [], missingImages: [] };
  for (const [i, row] of rows.entries()) {
    const id = String(row.legacy_id ?? row.id ?? ""),
      text = String(row.text ?? "");
    if (
      !id ||
      seen.has(id) ||
      [...text.trim()].length < 1 ||
      [...text.trim()].length > 500
    ) {
      report.errors.push({
        row: i + 1,
        id,
        reason: "Missing/duplicate ID or invalid text",
      });
      continue;
    }
    seen.add(id);
    const normalized = text.trim().toLocaleLowerCase("cs");
    if (texts.has(normalized))
      report.duplicates.push({ id, other: texts.get(normalized) });
    texts.set(normalized, id);
    const status = ["pending", "approved", "hidden", "rejected"].includes(
      row.status,
    )
      ? row.status
      : "pending";
    report.valid.push({
      legacy_id: id,
      text,
      status,
      image_path: row.image_path || null,
      image_alt: row.image_alt || "",
    });
  }
  return report;
}
export async function dryRun(file, imagesDir) {
  const rows = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(rows)) throw Error("Expected a JSON array");
  const report = mapRows(rows);
  for (const row of report.valid) {
    if (row.image_path) {
      const base = path.resolve(imagesDir || "."),
        image = path.resolve(base, row.image_path);
      if (!image.startsWith(base + path.sep)) {
        report.errors.push({
          id: row.legacy_id,
          reason: "Image path outside source directory",
        });
        continue;
      }
      try {
        await fs.access(image);
      } catch {
        report.missingImages.push({ id: row.legacy_id, path: row.image_path });
      }
    }
  }
  return report;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(
      new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    )
) {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: node scripts/import.mjs export.json [images-directory]. Dry run only.",
    );
    process.exitCode = 1;
  } else {
    const report = await dryRun(file, process.argv[3]);
    await fs.writeFile("import-report.json", JSON.stringify(report, null, 2));
    console.log(
      `${report.valid.length} valid, ${report.errors.length} errors, ${report.duplicates.length} duplicate texts, ${report.missingImages.length} missing images. No database writes.`,
    );
  }
}
