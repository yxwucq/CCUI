import type { ProjectInfo } from '@ccui/shared';

export async function fetchProjectInfo(): Promise<ProjectInfo> {
  const res = await fetch('/api/projects/info');
  return res.json();
}

export async function fetchGitBranches(): Promise<{ branches: string[]; current: string }> {
  const res = await fetch('/api/projects/git/branches');
  return res.json();
}

export async function fetchGitLog(limit = 150): Promise<any[]> {
  const res = await fetch(`/api/projects/git/log?limit=${limit}`);
  return res.json();
}
