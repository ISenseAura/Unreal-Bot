import esbuild from "esbuild";
import path from "path";
import fs from "fs/promises";

export async function compileSingleTS(tsFile: string): Promise<string | null> {
  try {
    const outfile = tsFile
      .replace("src", "dist")
      .replace(/\.ts$/, ".js");

    await esbuild.build({
      entryPoints: [tsFile],
      outfile,
      platform: "node",
      bundle: false,
      format: "cjs",
      sourcemap: false,
      target: "es2020",
    });

    console.log(`Compiled: ${tsFile} → ${outfile}`);
    return outfile;
  } catch (err) {
    console.error("TS compile failed:", err);
    return null;
  }
}
