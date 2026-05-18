export type StreamerToHub =
  | {
      type: 'register_streamer';
      sessionId: string;
      walletAddress: string;
      wsToken: string;
      streamerName?: string;
      description?: string;
      tool?: string;
    }
  | { type: 'stream_chunk'; data: string; ts: number }
  | { type: 'stream_end' };

export type HubToStreamer =
  | { type: 'registered'; code: string; sessionId: string }
  | { type: 'viewer_count'; count: number }
  | { type: 'new_tip'; from: string; amount: number }
  | { type: 'chat_unread'; count: number };

export interface CreateSessionRequest {
  streamerWallet: string;
  nonce: string;
  signature: string;
  streamerName?: string;
  description?: string;
  tool?: string;
  id?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  code: string;
  wsToken: string;
  startedAt: number;
}

export interface RequestNonceResponse {
  nonce: string;
  message?: string;
  expiresAt: number;
  ttlSeconds: number;
}

export type ViewerToHub =
  | { type: 'join'; sessionId: string; walletAddress?: string; handle?: string }
  | { type: 'switch_mode'; mode: 'feed' | 'raw' }
  | { type: 'chat_send'; content: string };

export interface ChatHistoryEntry {
  id: string;
  from: string;
  content: string;
  ts: number;
}

export type HubToViewer =
  | { type: 'snapshot'; sessions: LobbySession[] }
  | { type: 'feed_item'; item: FeedItem }
  | { type: 'raw_chunk'; data: string; ts: number }
  | { type: 'chat_msg'; from: string; content: string; ts: number }
  | { type: 'chat_history'; messages: ChatHistoryEntry[] }
  | { type: 'stream_end'; sessionId: string };

export interface LobbySession {
  id: string;
  streamerWallet: string;
  code: string;
  viewerCount: number;
  startedAt: number;
  streamerName?: string;
  description?: string;
  tool?: string;
  tipSol?: number;
}

export interface FeedItem {
  ts: number;
  headline: string;
  actions: string[];
  current_focus: string;
  mood: string;
}

export type SemanticEvent =
  | { v: 1; type: 'stdout'; ts: number; data: string }
  | { v: 1; type: 'command_start'; ts: number; command: string }
  | { v: 1; type: 'command_end'; ts: number; exitCode?: number }
  | {
      v: 1;
      type: 'turn';
      ts: number;
      role: 'user' | 'assistant';
      content: string;
    }
  | {
      v: 1;
      type: 'tool_call';
      ts: number;
      name: string;
      argsSummary?: string;
    }
  | {
      v: 1;
      type: 'file_edit';
      ts: number;
      path: string;
      diffSummary?: string;
    };
