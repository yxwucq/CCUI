import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { extname } from 'path';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
]);

export function readFile(filePath: string): { content: string | null; binary: boolean } {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return { content: null, binary: true };
  }
  const content = readFileSync(filePath, 'utf-8');
  return { content, binary: false };
}

export function writeFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8');
}

export function getGitDiff(filePath: string, cwd: string): string {
  try {
    return execSync(`git diff -- "${filePath}"`, { cwd, encoding: 'utf-8' });
  } catch {
    return '';
  }
}
