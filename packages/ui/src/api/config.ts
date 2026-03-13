export async function loadConfig(): Promise<any> {
  const res = await fetch('/api/config');
  return res.json();
}

export async function saveConfig(config: any): Promise<void> {
  await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
