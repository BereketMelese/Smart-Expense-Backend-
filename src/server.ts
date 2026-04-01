import "dotenv/config";
import { buildApp } from "./app";
import { env } from "./config/env";

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`Server running on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
