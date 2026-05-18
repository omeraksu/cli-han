import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  // GET /config — public hub configuration that clients need to construct
  // valid tip transactions. The fee collector pubkey is authoritative
  // here; the hub rejects any /tips submission that splits to a different
  // address.
  app.get('/config', async () => ({
    cluster: config.SOLANA_CLUSTER,
    feeCollector: config.HAN_FEE_COLLECTOR_PUBKEY,
    tipFeeBps: 300,
  }));
}
