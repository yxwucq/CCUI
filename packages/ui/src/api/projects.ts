import type { ProjectInfo, ProjectConfig } from '@ccui/shared';

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

export async function fetchProjectConfig(): Promise<ProjectConfig> {
  const res = await fetch('/api/project-config');
  return res.json();
}

export async function saveProjectConfig(config: Partial<ProjectConfig>): Promise<ProjectConfig> {
  const res = await fetch('/api/project-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function fetchInitInfo(): Promise<{
  branches: string[];
  worktrees: { path: string; branch: string; head: string }[];
  currentBranch: string;
  initialized: boolean;
}> {
  const res = await fetch('/api/project-config/init-info');
  return res.json();
}
