import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ENV_FILE_CANDIDATES = ['.env', '.env.local', '../.env', '../.env.local'];

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const separator = trimmed.indexOf('=');
  if (separator < 0) return null;

  const key = trimmed.slice(0, separator).trim();
  const rawValue = trimmed.slice(separator + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, '');

  if (!key) return null;
  return [key, value];
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadLocalEnv() {
  for (const relativePath of ENV_FILE_CANDIDATES) {
    const filePath = path.resolve(process.cwd(), relativePath);
    if (!(await fileExists(filePath))) continue;

    const text = await fs.readFile(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

