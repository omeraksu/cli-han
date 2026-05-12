-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(64) NOT NULL,
    "streamerWallet" VARCHAR(64) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "totalViewers" INTEGER NOT NULL DEFAULT 0,
    "totalTipsLamports" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(64) NOT NULL,
    "userWallet" VARCHAR(64) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(64) NOT NULL,
    "fromWallet" VARCHAR(64) NOT NULL,
    "toWallet" VARCHAR(64) NOT NULL,
    "amountLamports" BIGINT NOT NULL,
    "feeLamports" BIGINT NOT NULL DEFAULT 0,
    "streamerLamports" BIGINT NOT NULL DEFAULT 0,
    "txSignature" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" UUID NOT NULL,
    "gameType" VARCHAR(32) NOT NULL,
    "gameId" BIGINT NOT NULL,
    "players" JSONB NOT NULL,
    "winner" VARCHAR(64) NOT NULL,
    "stakeLamports" BIGINT NOT NULL,
    "potLamports" BIGINT NOT NULL,
    "attestationPda" VARCHAR(64),
    "attestationTx" VARCHAR(128),
    "settledTx" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "pda" VARCHAR(64) NOT NULL,
    "txSignature" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
