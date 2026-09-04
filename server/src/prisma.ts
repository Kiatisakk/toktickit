import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy server/.env.example to server/.env and start the database with `npm run db:up`."
  );
}

/**
 * A single PrismaClient shared by the whole process.
 *
 * Creating one client per request would open a new connection pool each time,
 * which exhausts PostgreSQL connections quickly.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
