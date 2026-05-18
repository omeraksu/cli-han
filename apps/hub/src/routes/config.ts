import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  // GET /config — public hub configuration that clients need to construct
  // valid tip transactions. The router/fee receiver addresses are
  // authoritative here; the hub rejects any /tips submission that splits
  // through a different contract.
  app.get('/config', async () => ({
    network: config.AVAX_NETWORK,
    chainId: config.AVAX_NETWORK === 'mainnet' ? 43114 : 43113,
    tipRouter: config.HAN_TIP_ROUTER_ADDRESS,
    feeReceiver: config.HAN_FEE_RECEIVER_ADDRESS,
    hanContract: config.HAN_CONTRACT_ADDRESS ?? null,
    tipFeeBps: 300,
  }));
}
