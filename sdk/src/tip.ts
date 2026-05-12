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
 * Send a tip from viewer to streamer (program-less, SystemProgram transfer).
 * @example
 *   const sig = await sendTip(conn, viewerKp, streamerPk, 0.05);
 */
export async function sendTip(
  connection: Connection,
  fromKeypair: Keypair,
  toWallet: PublicKey,
  amountSol: number,
  memo?: string,
): Promise<string> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  // Balance check — need amount + 5000 lamports for fees
  const balance = await connection.getBalance(fromKeypair.publicKey, 'confirmed');
  if (balance < lamports + 5000) {
    throw new TipError(
      `Insufficient balance: have ${balance} lamports, need ${lamports + 5000}`,
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
    const sig = await sendAndConfirmTransaction(connection, tx, [fromKeypair], {
      commitment: 'confirmed',
    });
    return sig;
  } catch (err) {
    throw new TipError('sendTip transaction failed', err);
  }
}
