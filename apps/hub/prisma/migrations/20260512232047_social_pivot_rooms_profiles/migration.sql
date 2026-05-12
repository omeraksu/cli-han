-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_sessionId_fkey";

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "roomId" VARCHAR(64),
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "game_results" ADD COLUMN     "roomId" VARCHAR(64);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "roomId" VARCHAR(64);

-- AlterTable
ALTER TABLE "tips" ADD COLUMN     "roomId" VARCHAR(64);

-- CreateTable
CREATE TABLE "rooms" (
    "id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "ownerWallet" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "wallet" VARCHAR(64) NOT NULL,
    "handle" VARCHAR(32) NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("wallet")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_roomId_key" ON "sessions"("roomId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

