import { useEffect, useState } from 'react';
import type { WsClient } from '../../transport/ws-client.js';
import type { FeedItem, SemanticEvent } from '../../transport/protocol.js';

const FEED_HISTORY = 50;
const RAW_HISTORY = 500;
const SEMANTIC_HISTORY = 100;

export interface StreamState {
  feedItems: FeedItem[];
  rawLines: string[];
  semantic: SemanticEvent[];
}

/**
 * Subscribes to feed_item, raw_chunk, and semantic_event frames and
 * keeps three bounded histories: the AI-summary feed, the raw shell
 * tail, and the structured turn/tool_call/file_edit timeline.
 */
export function useStream(client: WsClient | null): StreamState {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [semantic, setSemantic] = useState<SemanticEvent[]>([]);

  useEffect(() => {
    if (!client) return;

    client.on('feed_item', (payload) => {
      const p = payload as { item: FeedItem };
      setFeedItems((prev) => [...prev, p.item].slice(-FEED_HISTORY));
    });

    client.on('raw_chunk', (payload) => {
      const p = payload as { data: string };
      const chunkLines = p.data.split('\n');
      setRawLines((prev) => [...prev, ...chunkLines].slice(-RAW_HISTORY));
    });

    client.on('semantic_event', (payload) => {
      const p = payload as { event: SemanticEvent };
      setSemantic((prev) => [...prev, p.event].slice(-SEMANTIC_HISTORY));
    });
  }, [client]);

  return { feedItems, rawLines, semantic };
}
