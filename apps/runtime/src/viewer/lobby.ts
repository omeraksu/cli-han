import type { LobbySession } from '../transport/protocol.js';

export async function fetchLobby(hubUrl: string): Promise<LobbySession[]> {
  let res: Response;
  try {
    res = await fetch(`${hubUrl}/sessions`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[viewer] failed to reach hub: ${msg}`);
    return [];
  }

  if (!res.ok) {
    console.error(`[viewer] hub returned ${res.status}`);
    return [];
  }

  const data = (await res.json()) as { sessions?: LobbySession[] } | LobbySession[];

  if (Array.isArray(data)) {
    return data;
  }

  return data.sessions ?? [];
}
