import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

function filesUnder(path: string, extensions: Set<string>): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) result.push(...filesUnder(full, extensions));
    else if (extensions.has(entry.slice(entry.lastIndexOf(".")))) result.push(full);
  }
  return result;
}

const BANNED = [
  "a carregar",
  "a guardar",
  "aceder",
  "contacte",
  "decorre",
  "ecrã",
  "ficheiro",
  "guardar",
  "iniciar sessão",
  "ligação",
  "palavra-passe",
  "pretende",
  "registo",
  "utilizador",
  "pt-PT",
  "eliminar",
];

test("a interface não contém construções de português europeu", () => {
  const sources = filesUnder(join(ROOT, "src"), new Set([".ts", ".tsx", ".css"]));
  const found: string[] = [];
  for (const file of sources) {
    const text = stripComments(readFileSync(file, "utf8")).toLowerCase();
    for (const term of BANNED) {
      if (text.includes(term)) found.push(`${file}: ${term}`);
    }
  }
  assert.deepEqual(found, []);
});

test("as mensagens do backend também usam português do Brasil", () => {
  const file = join(ROOT, "..", "backend", "src", "messages.ts");
  const text = stripComments(readFileSync(file, "utf8")).toLowerCase();
  const found = BANNED.filter((term) => text.includes(term));
  assert.deepEqual(found, []);
});
