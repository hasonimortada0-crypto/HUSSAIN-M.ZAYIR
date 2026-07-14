import { getDatabase } from "@netlify/database";
import initialProducts from "../../../src/products.json";

export type JsonRecord = Record<string, unknown>;

export const database = getDatabase();

export async function ensureProductsSeeded() {
  const client = await database.pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [20260714]);

    const seedState = await client.query(
      "SELECT 1 FROM app_metadata WHERE key = $1",
      ["products_seeded"],
    );

    if (seedState.rowCount === 0) {
      await client.query(
        `INSERT INTO products (id, data)
         SELECT product->>'id', product
         FROM jsonb_array_elements($1::jsonb) AS product
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(initialProducts)],
      );
      await client.query(
        `INSERT INTO app_metadata (key, value)
         VALUES ($1, $2::jsonb)`,
        ["products_seeded", JSON.stringify({ source: "initial-catalog" })],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
