import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

export async function GET() {
  await connection();

  try {
    await db.execute(sql`select 1`);
    const vector = await db.execute(
      sql`select extname from pg_extension where extname = 'vector'`,
    );
    if (vector.rows.length === 0) {
      return Response.json({ ok: false, db: "error" }, { status: 503 });
    }
    return Response.json({ ok: true, db: "ok" });
  } catch {
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
