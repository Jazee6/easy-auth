import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOgSvg, generateOgImage } from "./generate-og-image";

describe("generate-og-image", () => {
  const generatedFiles: string[] = [];

  afterEach(async () => {
    for (const file of generatedFiles) {
      if (existsSync(file)) {
        await unlink(file).catch(() => {});
      }
    }
    generatedFiles.length = 0;
  });

  test("buildOgSvg returns standard 1200x630 SVG with expected elements", async () => {
    const svg = await buildOgSvg();
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain("Easy Auth");
    expect(svg).toContain('id="glow"');
    expect(svg).toContain('id="grid"');
    expect(svg).toContain("<path");
  });

  test("generateOgImage generates a valid PNG file", async () => {
    const outputPath = join(tmpdir(), `test-og-image-${Date.now()}.png`);
    generatedFiles.push(outputPath);

    const result = await generateOgImage({ outputPath });
    expect(result).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const fileStat = await stat(outputPath);
    expect(fileStat.size > 1000).toBe(true);
  });
});
