import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ log: ["warn", "error"] });
    // Enable SQLite WAL mode for concurrent read/write performance (P1)
    client.$queryRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
