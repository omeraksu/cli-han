export class HanSdkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'HanSdkError';
  }
}

export class EscrowError extends HanSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'EscrowError';
  }
}

export class TipError extends HanSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'TipError';
  }
}

export class WalletError extends HanSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'WalletError';
  }
}

export class RpcError extends HanSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'RpcError';
  }
}
