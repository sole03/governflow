-- Migration: add_cognition_graph
-- Generated: 2026-06-15
-- Description: Add CognitionNode, CognitionEdge, AstTemplate tables

-- CreateTable
CREATE TABLE "CognitionNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "semanticHash" TEXT NOT NULL,
    "abstractionLevel" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CognitionEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CognitionEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CognitionNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CognitionEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CognitionNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AstTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "templateDsl" TEXT NOT NULL,
    "validationSchema" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AstTemplate_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CognitionNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CognitionNode_semanticHash_key" ON "CognitionNode"("semanticHash");

-- CreateIndex
CREATE INDEX "CognitionNode_abstractionLevel_idx" ON "CognitionNode"("abstractionLevel");

-- CreateIndex
CREATE INDEX "CognitionNode_type_idx" ON "CognitionNode"("type");

-- CreateIndex
CREATE INDEX "CognitionEdge_sourceId_idx" ON "CognitionEdge"("sourceId");

-- CreateIndex
CREATE INDEX "CognitionEdge_targetId_idx" ON "CognitionEdge"("targetId");

-- CreateIndex
CREATE INDEX "CognitionEdge_relation_idx" ON "CognitionEdge"("relation");

-- CreateIndex
CREATE UNIQUE INDEX "CognitionEdge_sourceId_targetId_relation_key" ON "CognitionEdge"("sourceId", "targetId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "AstTemplate_nodeId_key" ON "AstTemplate"("nodeId");

