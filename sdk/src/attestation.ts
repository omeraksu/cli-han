import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AttestationError } from './errors.js';

export interface AttestParams {
  roomId: bigint;
  winner: PublicKey;
  gameType: string;
  score: number;
  playerCount: number;
}

export interface AttestResult {
  signature: string;
  attestationPda: string;
}

/**
 * Attest a game result using SAS (Solana Attestation Service).
 *
 * NOTE: sas-lib is not yet available on npm. This implementation is a stub.
 * When sas-lib is installed, replace the body with the real implementation:
 *
 *   import { getCreateAttestationInstruction } from 'sas-lib';
 *   // nonce: roomId.toString() — BigInt-safe, no Number() truncation
 *   const nonce = params.roomId.toString();
 *   const ix = getCreateAttestationInstruction({ ... nonce, ... });
 *   // hub authority signs, send tx, return signature + attestation PDA
 */
export async function attestGameResult(
  connection: Connection,
  hubAuthority: Keypair,
  credentialPda: PublicKey,
  schemaPda: PublicKey,
  params: AttestParams,
): Promise<AttestResult> {
  // Stub — sas-lib not yet available
  void connection;
  void hubAuthority;
  void credentialPda;
  void schemaPda;

  const nonce = params.roomId.toString(); // BigInt-safe nonce
  void nonce;

  throw new AttestationError(
    'attestGameResult: sas-lib not yet installed. Install sas-lib and implement using getCreateAttestationInstruction. nonce = roomId.toString().',
  );
}

/**
 * Fetch an existing attestation account from the chain.
 */
export async function fetchGameAttestation(
  connection: Connection,
  attestationPda: PublicKey,
): Promise<unknown | null> {
  try {
    const info = await connection.getAccountInfo(attestationPda, 'confirmed');
    if (!info) return null;
    // Raw account data returned — caller parses with sas-lib when available
    return info;
  } catch (err) {
    throw new AttestationError('fetchGameAttestation failed', err);
  }
}
