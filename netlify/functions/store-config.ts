import { database, type JsonRecord } from "./_shared/database";
import { errorResponse, json, methodNotAllowed } from "./_shared/http";

type FunctionContext = { requestId?: string };

export default async function handler(request: Request, context: FunctionContext) {
  try {
    if (request.method === "GET") {
      const [row] = await database.sql`SELECT data FROM store_config WHERE id = ${"store"}`;
      return json(row?.data || {});
    }

    if (request.method === "POST" || request.method === "PUT") {
      const config = await request.json() as JsonRecord;
      const [saved] = await database.sql`
        INSERT INTO store_config (id, data)
        VALUES (${"store"}, CAST(${JSON.stringify(config)} AS jsonb))
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
        RETURNING data
      `;
      console.log("database_operation_succeeded", {
        resource: "config",
        method: request.method,
        requestId: context.requestId,
        status: 200,
      });
      return json(saved.data);
    }

    return methodNotAllowed(["GET", "POST", "PUT"]);
  } catch (error) {
    return errorResponse(error, `config:${request.method}`, context.requestId);
  }
}

export const config = { path: "/api/config" };
