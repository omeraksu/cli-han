-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "email" VARCHAR(128),
ADD COLUMN     "ssoProvider" VARCHAR(16),
ADD COLUMN     "ssoSubject" VARCHAR(128);

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "teamId" UUID;

-- CreateTable
CREATE TABLE "event_members" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "invitedBy" VARCHAR(42),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "role" VARCHAR(16) NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_signals" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "teamId" UUID,
    "sessionId" VARCHAR(64) NOT NULL,
    "reason" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(42),

    CONSTRAINT "help_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_attestations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "anchorTxHash" VARCHAR(66),
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_members_eventId_idx" ON "event_members"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_eventId_wallet_key" ON "event_members"("eventId", "wallet");

-- CreateIndex
CREATE INDEX "teams_eventId_idx" ON "teams"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_eventId_slug_key" ON "teams"("eventId", "slug");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_wallet_key" ON "team_members"("teamId", "wallet");

-- CreateIndex
CREATE INDEX "help_signals_eventId_idx" ON "help_signals"("eventId");

-- CreateIndex
CREATE INDEX "help_signals_teamId_idx" ON "help_signals"("teamId");

-- CreateIndex
CREATE INDEX "builder_attestations_eventId_idx" ON "builder_attestations"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "builder_attestations_eventId_wallet_key" ON "builder_attestations"("eventId", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_ssoProvider_ssoSubject_key" ON "profiles"("ssoProvider", "ssoSubject");

-- CreateIndex
CREATE INDEX "submissions_teamId_idx" ON "submissions"("teamId");

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "profiles"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "profiles"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_signals" ADD CONSTRAINT "help_signals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_signals" ADD CONSTRAINT "help_signals_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_attestations" ADD CONSTRAINT "builder_attestations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_attestations" ADD CONSTRAINT "builder_attestations_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "profiles"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

