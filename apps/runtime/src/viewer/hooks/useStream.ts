import { useEffect, useRef, useState } from 'react';
import type { WsClient } from '../../transport/ws-client.js';
import type { FeedItem, SemanticEvent } from '../../transport/protocol.js';
import { TerminalEmulator, type TerminalSnapshot } from '../terminal-emulator.js';

const FEED_HISTORY = 50;
const SEMANTIC_HISTORY = 100;
const SNAPSHOT_THROTTLE_MS = 40;

export interface StreamState {
  feedItems: FeedItem[];
  terminalSnapshot: TerminalSnapshot | null;
  semantic: SemanticEvent[];
}

/**
 * Subscribes to feed_item, raw_chunk, and semantic_event frames.
 * Raw chunks feed an off-screen xterm emulator; snapshots of its 2D
 * cell grid are surfaced as state at most every SNAPSHOT_THROTTLE_MS,
 * so React renders track the broadcaster's full-screen TUI faithfully.
 */
export function useStream(client: WsClient | null): StreamState {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [semantic, setSemantic] = useState<SemanticEvent[]>([]);
  const emulatorRef = useRef<TerminalEmulator | null>(null);
  const pendingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!client) return;
    if (!emulatorRef.current) {
      emulatorRef.current = new TerminalEmulator();
      setSnapshot(emulatorRef.current.snapshot());
    }

    const scheduleSnapshot = (): void => {
      if (pendingRef.current) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        if (emulatorRef.current) {
          setSnapshot(emulatorRef.current.snapshot());
        }
      }, SNAPSHOT_THROTTLE_MS);
    };

    client.on('feed_item', (payload) => {
      const p = payload as { item: FeedItem };
      setFeedItems((prev) => [...prev, p.item].slice(-FEED_HISTORY));
    });

    client.on('raw_chunk', (payload) => {
      const p = payload as { data: string };
      if (emulatorRef.current) {
        emulatorRef.current.write(p.data);
        scheduleSnapshot();
      }
    });

    client.on('semantic_event', (payload) => {
      const p = payload as { event: SemanticEvent };
      setSemantic((prev) => [...prev, p.event].slice(-SEMANTIC_HISTORY));
    });

    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, [client]);

  return { feedItems, terminalSnapshot: snapshot, semantic };
}
