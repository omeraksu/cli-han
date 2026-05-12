import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import { TipError } from './errors.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Han tip commission, expressed in basis points (300 = 3%).
 *
 * Hardcoded for V1; fee rate changes ship via SDK release. V2 may move
 * the rate into an on-chain `tip()` Anchor instruction.
 *
 * @see ADR 2026-05-13-tip-fee-architecture
 */
export const TIP_FEE_BPS = 300;

const BPS_DENOMINATOR = 10_000;
const TX_FEE_BUFFER = 5_000;

export interface SendTipWithFeeParams {
  connection: Connection;
  viewer: Keypair;
  streamer: PublicKey;
  feeCollector: PublicKey;
  amountSol: number;
  memo?: string;
}

export interface SendTipWithFeeResult {
  signature: string;
  amountLamports: number;
  feeLamports: number;
  streamerLamports: number;
}

/**
 * Sends a tip with a 3% Han commission as a single atomic transaction.
 *
 * Two SystemProgram::transfer instructions ride in one TX:
 *   1) viewer → fee collector : amount * 0.03
 *   2) viewer → streamer      : amount - fee
 *
 * Both transfers settle atomically. If either fails the whole TX reverts.
 *
 * @example
 *   const result = await sendTipWithFee({
 *     connection,
 *     viewer: viewerKp,
 *     streamer: streamerPubkey,
 *     feeCollector: feeCollectorPubkey,
 *     amountSol: 0.05,
 *   });
 *   console.log(`Tipped 0.05 SOL · sig ${result.signature}`);
 */
export async function sendTipWithFee(
  params: SendTipWithFeeParams,
): Promise<SendTipWithFeeResult> {
  const { connection, viewer, streamer, feeCollector, amountSol, memo } = params;

  if (amountSol <= 0) {
    throw new TipError(`Tip amount must be positive (got ${amountSol})`);
  }

  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const feeLamports = Math.floor((amountLamports * TIP_FEE_BPS) / BPS_DENOMINATOR);
  const streamerLamports = amountLamports - feeLamports;

  if (streamerLamports <= 0) {
    throw new TipError(`Tip too small after fee (amount ${amountLamports} lamports)`);
  }

  const balance = await connection.getBalance(viewer.publicKey, 'confirmed');
  if (balance < amountLamports + TX_FEE_BUFFER) {
    throw new TipError(
      `Insufficient balance: have ${balance} lamports, need ${amountLamports + TX_FEE_BUFFER}`,
    );
  }

  const tx = new Transaction();

  tx.add(
    SystemProgram.transfer({
      fromPubkey: viewer.publicKey,
      toPubkey: feeCollector,
      lamports: feeLamports,
    }),
  );

  tx.add(
    SystemProgram.transfer({
      fromPubkey: viewer.publicKey,
      toPubkey: streamer,
      lamports: streamerLamports,
    }),
  );

  if (memo) {
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: viewer.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, 'utf-8'),
      }),
    );
  }

  try {
    const signature = await sendAndConfirmTransaction(connection, tx, [viewer], {
      commitment: 'confirmed',
    });
    return { signature, amountLamports, feeLamports, streamerLamports };
  } catch (err) {
    throw new TipError('sendTipWithFee transaction failed', err);
  }
}

/**
 * @deprecated Use {@link sendTipWithFee} so the Han hub gets its 3%
 * commission. Plain `sendTip` will be removed in V2.
 */
export async function sendTip(
  connection: Connection,
  fromKeypair: Keypair,
  toWallet: PublicKey,
  amountSol: number,
  memo?: string,
): Promise<string> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const balance = await connection.getBalance(fromKeypair.publicKey, 'confirmed');
  if (balance < lamports + TX_FEE_BUFFER) {
    throw new TipError(
      `Insufficient balance: have ${balance} lamports, need ${lamports + TX_FEE_BUFFER}`,
    );
  }

  const tx = new Transaction();

  tx.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toWallet,
      lamports,
    }),
  );

  if (memo) {
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: fromKeypair.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, 'utf-8'),
      }),
    );
  }

  try {
    return await sendAndConfirmTransaction(connection, tx, [fromKeypair], {
      commitment: 'confirmed',
    });
  } catch (err) {
    throw new TipError('sendTip transaction failed', err);
  }
}
