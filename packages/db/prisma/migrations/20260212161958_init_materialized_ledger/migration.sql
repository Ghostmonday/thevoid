-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActorState" (
    "actorId" TEXT NOT NULL PRIMARY KEY,
    "currentXp" INTEGER NOT NULL DEFAULT 0,
    "pendingXp" INTEGER NOT NULL DEFAULT 0,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "decayRate" REAL NOT NULL DEFAULT 0.0,
    "lastActivity" DATETIME,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleHistory" TEXT NOT NULL DEFAULT '[]'
);

-- CreateIndex
CREATE INDEX "Event_actorId_timestamp_idx" ON "Event"("actorId", "timestamp" DESC);
