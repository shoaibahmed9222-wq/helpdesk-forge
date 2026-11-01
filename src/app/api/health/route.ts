import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { deploymentStatus } from "@/lib/production-config";

export async function GET() {
  await connection();
  const config = deploymentStatus();

  try {
    await db.execute(sql`select 1`);
    const vector = await db.execute(
      sql`select extname from pg_extension where extname = 'vector'`,
    );
    const pgvector = vector.rows.length > 0 ? "ok" : "missing";
    const ok = pgvector === "ok";
    return Response.json(
      { ok, db: "ok", pgvector, ...config },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return Response.json(
      { ok: false, db: "error", pgvector: "unknown", ...config },
      { status: 503 },
    );
  }
}
