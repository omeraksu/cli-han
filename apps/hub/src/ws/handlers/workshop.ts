import { z } from 'zod';

import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';

// In-memory map: eventId → set of student conn ids who joined the workshop.
// Sprint 8 moves this to Redis so multi-instance hubs can share it.
const studentsByEvent = new Map<string, Set<string>>();
// Track each conn's joined event so cleanup on disconnect is O(1).
const eventByConn = new Map<string, string>();

function joinStudent(eventId: string, connId: string): void {
  let set = studentsByEvent.get(eventId);
  if (!set) {
    set = new Set();
    studentsByEvent.set(eventId, set);
  }
  set.add(connId);
  eventByConn.set(connId, eventId);
}

export function leaveWorkshop(connId: string): string | undefined {
  const eventId = eventByConn.get(connId);
  if (!eventId) return undefined;
  studentsByEvent.get(eventId)?.delete(connId);
  eventByConn.delete(connId);
  return eventId;
}

const joinSchema = z.object({
  eventSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
});

const cursorSchema = z.object({
  eventSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  lesson: z.string().max(64),
  cursor: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

export function makeWorkshopHandlers(ctx: HubContext) {
  async function handleWorkshopJoin(conn: Connection, payload: unknown): Promise<void> {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid workshop_join payload' }));
      return;
    }
    const event = await ctx.db.event.findUnique({ where: { slug: parsed.data.eventSlug } });
    if (!event) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'event not found' }));
      return;
    }
    conn.type = 'member';
    ctx.gateway.register(conn);
    joinStudent(event.id, conn.id);
    logger.info({ connId: conn.id, eventId: event.id }, 'workshop joined');
    conn.ws.send(JSON.stringify({ type: 'workshop_joined', eventId: event.id, eventSlug: event.slug }));
  }

  // Instructor publishes the current lesson cursor; hub fans it out to every
  // student that has joined the same event.
  async function handleWorkshopCursor(conn: Connection, payload: unknown): Promise<void> {
    const parsed = cursorSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid workshop_cursor payload' }));
      return;
    }
    const event = await ctx.db.event.findUnique({ where: { slug: parsed.data.eventSlug } });
    if (!event) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'event not found' }));
      return;
    }
    const set = studentsByEvent.get(event.id);
    if (!set) {
      conn.ws.send(JSON.stringify({ type: 'workshop_cursor_ack', recipients: 0 }));
      return;
    }
    let n = 0;
    for (const studentId of set) {
      if (studentId === conn.id) continue;
      ctx.gateway.send(studentId, {
        type: 'workshop_lesson',
        eventId: event.id,
        lesson: parsed.data.lesson,
        cursor: parsed.data.cursor,
        note: parsed.data.note,
        ts: Date.now(),
      });
      n++;
    }
    conn.ws.send(JSON.stringify({ type: 'workshop_cursor_ack', recipients: n }));
  }

  return { handleWorkshopJoin, handleWorkshopCursor };
}
