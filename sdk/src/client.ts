// @coral-xyz/anchor ships as CommonJS, so under Node ESM we have to go
// through the default export and pull the named bits out manually.
import anchorPkg from '@coral-xyz/anchor';
import type { Idl, Program as ProgramType } from '@coral-xyz/anchor';
const { AnchorProvider, Program, BN } = anchorPkg;
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  type Signer,
} from '@solana/web3.js';
import { FailoverConnection } from './rpc-client.js';
import HanIdl from '../idl/han.json' with { type: 'json' };

export const HAN_PROGRAM_ID = new PublicKey('D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD');

export interface HanClientOptions {
  connection: Connection | FailoverConnection;
  wallet: Keypair;
  programId?: PublicKey;
}

// Minimal wallet adapter compatible with AnchorProvider
class KeypairWallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer as Signer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer as Signer);
      }
      return tx;
    });
  }
}

export class HanClient {
  readonly program: ProgramType;
  readonly connection: Connection;
  readonly wallet: Keypair;

  constructor(opts: HanClientOptions) {
    this.wallet = opts.wallet;

    if (opts.connection instanceof FailoverConnection) {
      this.connection = opts.connection.getConnection();
    } else {
      this.connection = opts.connection;
    }

    const kpWallet = new KeypairWallet(opts.wallet);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new AnchorProvider(this.connection, kpWallet as any, {
      commitment: 'confirmed',
    });

    this.program = new Program(HanIdl as Idl, provider);

    const programId = opts.programId ?? HAN_PROGRAM_ID;
    if (!programId.equals(HAN_PROGRAM_ID)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.program as any)._programId = programId;
    }
  }

  findRoomPda(roomId: bigint): [PublicKey, number] {
    const roomIdBN = new BN(roomId.toString());
    const seedBytes = roomIdBN.toArrayLike(Buffer, 'le', 8);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('room'), seedBytes],
      this.program.programId,
    );
  }

  findVaultPda(roomId: bigint): [PublicKey, number] {
    const roomIdBN = new BN(roomId.toString());
    const seedBytes = roomIdBN.toArrayLike(Buffer, 'le', 8);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), seedBytes],
      this.program.programId,
    );
  }

  findConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      this.program.programId,
    );
  }
}
