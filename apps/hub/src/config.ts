import { z } from 'zod';

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed 20-byte hex address');

const optionalEvmAddress = evmAddress.optional();

const hexPrivateKey = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'must be a 0x-prefixed 32-byte hex private key')
  .optional();

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/han_avax'),
  AVAX_NETWORK: z.enum(['fuji', 'mainnet', 'localhost']).default('fuji'),
  AVAX_RPC_URL: z.string().default('https://api.avax-test.network/ext/bc/C/rpc'),
  AVAX_RPC_FALLBACK_URLS: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean)
        : [],
    ),
  ANTHROPIC_API_KEY: z.string().optional(),
  HUB_AUTHORITY_PRIVATE_KEY: hexPrivateKey,
  HAN_CONTRACT_ADDRESS: optionalEvmAddress,
  HAN_TIP_ROUTER_ADDRESS: evmAddress,
  HAN_FEE_RECEIVER_ADDRESS: evmAddress,
});

export const config = schema.parse(process.env);
export type Config = typeof config;
