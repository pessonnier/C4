import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(ROOT, relativePath), "utf8"));
}

export async function readText(relativePath) {
  return readFile(path.resolve(ROOT, relativePath), "utf8");
}

export async function writeJson(relativePath, value) {
  const target = path.resolve(ROOT, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

export function flag(name) {
  return process.argv.includes(name);
}
