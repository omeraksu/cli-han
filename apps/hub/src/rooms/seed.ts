import type { RoomRegistry } from './registry.js';

interface ChannelSeed {
  id: string;
  slug: string;
  title: string;
  description: string;
}

export const SEED_CHANNELS: ChannelSeed[] = [
  {
    id: 'han-lobby',
    slug: 'han-lobby',
    title: 'han lobby',
    description: "han'a yeni gelen herkesin ana odası — sohbet, oyun queue, tanışma",
  },
  {
    id: 'turkce',
    slug: 'turkce',
    title: 'türkçe',
    description: 'türkçe konuşan dev hub',
  },
  {
    id: 'indie-devs',
    slug: 'indie-devs',
    title: 'indie devs',
    description: 'solo / küçük takım, ürün, gelir, AI tooling sohbeti',
  },
  {
    id: 'ai-coding',
    slug: 'ai-coding',
    title: 'AI coding',
    description: 'claude code, cursor, aider, copilot — tooling pratiği',
  },
];

export async function seedChannels(rooms: RoomRegistry): Promise<void> {
  for (const c of SEED_CHANNELS) {
    await rooms.seedChannel({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
    });
  }
}
