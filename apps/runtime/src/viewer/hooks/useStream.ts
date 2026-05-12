import { useEffect, useState } from 'react';
import type { WsClient } from '../../transport/ws-client.js';
import type { FeedItem } from '../../transport/protocol.js';

const FEED_HISTORY = 50;
const RAW_HISTORY = 500;

export interface StreamState {
  feedItems: FeedItem[];
  rawLines: string[];
}

/**
 * Subscribes to feed_item and raw_chunk frames from the hub and keeps
 * a bounded history in React state.
 */
export function useStream(client: WsClient | null): StreamState {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);

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
  }, [client]);

  return { feedItems, rawLines };
}
