import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface MemoryEntry {
  filename: string;
  name: string;
  description: string;
  type: string;
  rawContent: string;
}

function parseMemoryFile(filename: string, rawContent: string): MemoryEntry {
  const match = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) {
    const fm = match[1];
    const name = fm.match(/name:\s*(.+)/)?.[1]?.trim() || filename.replace('.md', '');
    const description = fm.match(/description:\s*(.+)/)?.[1]?.trim() || '';
    const type = fm.match(/type:\s*(.+)/)?.[1]?.trim() || 'user';
    return { filename, name, description, type, rawContent };
  }
  return { filename, name: filename.replace('.md', ''), description: '', type: 'user', rawContent };
}

function getMemoryDir(runDir: string): string {
  const slug = runDir.replace(/[^a-zA-Z0-9-]/g, '-');
  return join(homedir(), '.claude', 'projects', slug, 'memory');
}

/** List all memory files for a session's working directory */
export function listMemories(runDir: string): MemoryEntry[] {
  const memoryDir = getMemoryDir(runDir);
  if (!existsSync(memoryDir)) return [];
  const files = readdirSync(memoryDir).filter((f) => f.endsWith('.md')).sort();
  return files.map((filename) => {
    const rawContent = readFileSync(join(memoryDir, filename), 'utf-8');
    return parseMemoryFile(filename, rawContent);
  });
}

/** Save a memory file */
export function saveMemory(runDir: string, filename: string, content: string): void {
  const memoryDir = getMemoryDir(runDir);
  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(join(memoryDir, filename), content, 'utf-8');
}
