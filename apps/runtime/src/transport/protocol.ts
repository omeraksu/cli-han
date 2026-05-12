export type StreamerToHub =
  | { type: 'register_streamer'; sessionId: string; walletAddress: string }
  | { type: 'stream_chunk'; data: string; ts: number }
  | { type: 'stream_end' };

export type HubToStreamer =
  | { type: 'registered'; code: string; sessionId: string }
  | { type: 'viewer_count'; count: number }
  | { type: 'new_tip'; from: string; amount: number }
  | { type: 'chat_unread'; count: number };

export type ViewerToHub =
  | { type: 'join'; sessionId: string }
  | { type: 'switch_mode'; mode: 'feed' | 'raw' }
  | { type: 'chat_send'; content: string };

export type HubToViewer =
  | { type: 'snapshot'; sessions: LobbySession[] }
  | { type: 'feed_item'; item: FeedItem }
  | { type: 'raw_chunk'; data: string; ts: number }
  | { type: 'chat_msg'; from: string; content: string; ts: number };

export interface LobbySession {
  id: string;
  streamerWallet: string;
  code: string;
  viewerCount: number;
  startedAt: number;
}

export interface FeedItem {
  ts: number;
  headline: string;
  actions: string[];
  current_focus: string;
  mood: string;
}
