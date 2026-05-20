-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "eventId" UUID,
ADD COLUMN     "teamLabel" VARCHAR(64);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "organizerWallet" VARCHAR(42) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "plan" VARCHAR(32) NOT NULL DEFAULT 'corpus-report',
    "brand" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "teamLabel" VARCHAR(64) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "summary" TEXT,
    "repoUrl" VARCHAR(256),
    "demoUrl" VARCHAR(256),
    "anchorTxHash" VARCHAR(66),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_reports" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'queued',
    "frictionMap" JSONB,
    "pdfPath" VARCHAR(256),
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "submissions_eventId_idx" ON "submissions"("eventId");

-- CreateIndex
CREATE INDEX "corpus_reports_eventId_idx" ON "corpus_reports"("eventId");

-- CreateIndex
CREATE INDEX "sessions_eventId_idx" ON "sessions"("eventId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corpus_reports" ADD CONSTRAINT "corpus_reports_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
