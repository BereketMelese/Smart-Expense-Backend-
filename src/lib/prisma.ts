import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "../config/env";

const connectionUrl = new URL(env.DATABASE_URL);
if (connectionUrl.searchParams.get("sslmode") === "require") {
	connectionUrl.searchParams.set("sslmode", "no-verify");
}

const pool = new Pool({
	connectionString: connectionUrl.toString()
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
