import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GenerateOgImageOptions {
  iconPath?: string;
  outputPath?: string;
  width?: number;
  height?: number;
}

const DEFAULT_ICON_PATH = resolve(import.meta.dirname, "../public/icon.svg");
const DEFAULT_OUTPUT_PATH = resolve(import.meta.dirname, "../public/og-image.png");
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;

export async function buildOgSvg(iconPath: string = DEFAULT_ICON_PATH): Promise<string> {
  let innerIconElements: string;
  try {
    const iconSvgContent = await readFile(iconPath, "utf8");
    const match = iconSvgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    innerIconElements = match ? match[1].trim() : "";
  } catch {
    // Fallback to default Lucide IdCard icon paths
    innerIconElements = `
      <path d="M16 10h2"/>
      <path d="M16 14h2"/>
      <path d="M6.17 15a3 3 0 0 1 5.66 0"/>
      <circle cx="9" cy="11" r="2"/>
      <rect x="2" y="5" width="20" height="14" rx="2"/>
    `.trim();
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" viewBox="0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}">
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#222227" stroke-width="1"/>
    </pattern>
    <radialGradient id="glow" cx="18%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#27272a" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#141417" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" fill="#09090b"/>
  <rect width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" fill="url(#grid)"/>
  <rect width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}" fill="url(#glow)"/>

  <!-- Icon: IdCard scaled up from 24x24 to 108x108 at (140, 195) -->
  <g transform="translate(140, 195) scale(4.5)" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${innerIconElements}
  </g>

  <!-- Title: Easy Auth at (140, 395) -->
  <text x="140" y="395" fill="#fafafa" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Inter Variable', 'Segoe UI', Roboto, sans-serif" font-size="84" font-weight="700" letter-spacing="-0.035em">Easy Auth</text>
</svg>`;
}

export async function generateOgImage(options: GenerateOgImageOptions = {}): Promise<string> {
  const iconPath = options.iconPath ?? DEFAULT_ICON_PATH;
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;

  const svgContent = await buildOgSvg(iconPath);
  const tempSvgPath = join(
    tmpdir(),
    `easy-auth-og-${Date.now()}-${Math.random().toString(36).slice(2)}.svg`,
  );

  try {
    await writeFile(tempSvgPath, svgContent, "utf8");
    await execFileAsync("sips", ["-s", "format", "png", tempSvgPath, "--out", outputPath]);
    return outputPath;
  } finally {
    await unlink(tempSvgPath).catch(() => {});
  }
}

if (import.meta.main) {
  generateOgImage()
    .then((out) => {
      console.log(`Successfully generated Open Graph image at: ${out}`);
    })
    .catch((err) => {
      console.error("Failed to generate Open Graph image:", err);
      process.exit(1);
    });
}
