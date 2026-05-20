-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(64) NOT NULL,
    "streamerWallet" VARCHAR(42) NOT NULL,
    "wsToken" VARCHAR(64),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "totalViewers" INTEGER NOT NULL DEFAULT 0,
    "totalTipsWei" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "roomId" VARCHAR(64),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "ownerWallet" VARCHAR(42),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "wallet" VARCHAR(42) NOT NULL,
    "handle" VARCHAR(32) NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(64),
    "roomId" VARCHAR(64),
    "userWallet" VARCHAR(42) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(64) NOT NULL,
    "roomId" VARCHAR(64),
    "fromWallet" VARCHAR(42) NOT NULL,
    "toWallet" VARCHAR(42) NOT NULL,
    "amountWei" DECIMAL(78,0) NOT NULL,
    "feeWei" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "streamerWei" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "txHash" VARCHAR(66) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" UUID NOT NULL,
    "gameType" VARCHAR(32) NOT NULL,
    "gameId" BIGINT NOT NULL,
    "players" JSONB NOT NULL,
    "winner" VARCHAR(42) NOT NULL,
    "stakeWei" DECIMAL(78,0) NOT NULL,
    "potWei" DECIMAL(78,0) NOT NULL,
    "roomId" VARCHAR(64),
    "settledTx" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_roomId_key" ON "sessions"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles"("handle");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
