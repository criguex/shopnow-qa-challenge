// Renders docs/scenes/explained.html frame by frame and exports docs/assets/explained[.es].gif and .mp4.
// Usage: node docs/scenes/export.mjs   (needs ffmpeg on PATH)
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets");
const FPS = 10;
const browser = await chromium.launch();

for (const lang of ["en", "es"]) {
  const frames = mkdtempSync(join(tmpdir(), `explained-${lang}-`));
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.goto(`file://${join(here, "explained.html")}?lang=${lang}`);
  const total = await page.evaluate(() => window.TOTAL);
  const count = Math.round(total * FPS);
  for (let f = 0; f <= count; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    await page.screenshot({ path: join(frames, `f${String(f).padStart(4, "0")}.png`) });
  }
  await page.close();
  const suffix = lang === "en" ? "" : ".es";
  const input = `-framerate ${FPS} -i "${join(frames, "f%04d.png")}"`;
  execSync(`ffmpeg -loglevel error -y ${input} -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 24 "${join(assets, `explained${suffix}.mp4`)}"`);
  execSync(`ffmpeg -loglevel error -y ${input} -vf "fps=${FPS},scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" "${join(assets, `explained${suffix}.gif`)}"`);
  rmSync(frames, { recursive: true, force: true });
  console.log(`explained${suffix}: ${count + 1} frames`);
}
await browser.close();
