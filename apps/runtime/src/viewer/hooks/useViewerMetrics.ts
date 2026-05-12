import { useEffect, useState } from 'react';
import type { WsClient } from '../../transport/ws-client.js';

export interface ViewerMetrics {
  viewerCount: number;
  tipSol: number;
  lastTipFrom?: string;
  lastTipAmount?: number;
}

/**
 * Tracks the session-level numbers that show up in the viewer footer:
 * how many people are watching, how much SOL has been tipped, and the
 * most recent tip event (for inline toasts).
 */
export function useViewerMetrics(client: WsClient | null): ViewerMetrics {
  const [metrics, setMetrics] = useState<ViewerMetrics>({
    viewerCount: 0,
    tipSol: 0,
  });

  useEffect(() => {
    if (!client) return;

    client.on('viewer_count', (payload) => {
      const p = payload as { count: number };
      setMetrics((m) => ({ ...m, viewerCount: p.count }));
    });

    client.on('tip_event', (payload) => {
      const p = payload as { from: string; amount: number; tipSol: number };
      setMetrics((m) => ({
        ...m,
        tipSol: p.tipSol,
        lastTipFrom: p.from,
        lastTipAmount: p.amount,
      }));
    });

    client.on('joined', (payload) => {
      const p = payload as {
        session?: { viewerCount?: number; tipSol?: number };
      };
      if (p.session) {
        setMetrics((m) => ({
          ...m,
          viewerCount: p.session?.viewerCount ?? m.viewerCount,
          tipSol: p.session?.tipSol ?? m.tipSol,
        }));
      }
    });
  }, [client]);

  return metrics;
}
