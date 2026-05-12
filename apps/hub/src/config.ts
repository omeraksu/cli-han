import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/han'),
  SOLANA_CLUSTER: z.enum(['devnet', 'mainnet-beta', 'localnet']).default('devnet'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  HELIUS_RPC_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  HUB_AUTHORITY_KEYPAIR: z.string().optional(),
  HAN_PROGRAM_ID: z.string().optional(),
  SAS_CREDENTIAL_PDA: z.string().optional(),
  SAS_SCHEMA_PDA: z.string().optional(),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
