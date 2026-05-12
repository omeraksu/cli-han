import { useEffect, useState, useCallback } from 'react';
import type { WsClient } from '../../transport/ws-client.js';
import type { ChatMessage } from '../../ui/ChatPanel.js';

const CHAT_HISTORY = 100;

interface ChatApi {
  messages: ChatMessage[];
  send: (text: string) => void;
}

/**
 * Subscribes to chat_msg frames and exposes a `send` helper that emits
 * `chat_send` to the hub.
 */
export function useChat(client: WsClient | null): ChatApi {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!client) return;
    client.on('chat_msg', (payload) => {
      const p = payload as { from: string; content: string; ts: number };
      setMessages((prev) => {
        const next: ChatMessage = {
          id: `${p.ts}-${p.from}-${prev.length}`,
          user: p.from,
          text: p.content,
          ts: p.ts,
        };
        return [...prev, next].slice(-CHAT_HISTORY);
      });
    });
  }, [client]);

  const send = useCallback(
    (text: string) => {
      if (!client) return;
      client.send({ type: 'chat_send', content: text });
    },
    [client]
  );

  return { messages, send };
}
