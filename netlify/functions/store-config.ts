import { database, type JsonRecord } from "./_shared/database";
import { errorResponse, json, methodNotAllowed } from "./_shared/http";

type FunctionContext = { requestId?: string };

const imageKeys = ["heroImage", "slide1", "slide2", "slide3"] as const;

function mapConfigImages(config: JsonRecord, updatedAt: unknown) {
  const version = new Date(updatedAt as string | number | Date).getTime();
  const mapped = { ...config };

  for (const key of imageKeys) {
    const image = mapped[key];
    if (typeof image === "string" && image.startsWith("data:image/")) {
      mapped[key] = `/api/config-images/${key}?v=${version}`;
    }
  }

  return mapped;
}

function isGeneratedImagePath(value: unknown) {
  return typeof value === "string" && value.startsWith("/api/config-images/");
}

export default async function handler(request: Request, context: FunctionContext) {
  try {
    if (request.method === "GET") {
      const [row] = await database.sql`SELECT data, updated_at FROM store_config WHERE id = ${"store"}`;
      return json(row ? mapConfigImages(row.data as JsonRecord, row.updated_at) : {}, 200, {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        "Netlify-CDN-Cache-Control": "public, durable, max-age=60, stale-while-revalidate=300",
      });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const config = await request.json() as JsonRecord;
      const [current] = await database.sql`SELECT data FROM store_config WHERE id = ${"store"}`;
      const currentConfig = (current?.data || {}) as JsonRecord;

      for (const key of imageKeys) {
        if (isGeneratedImagePath(config[key])) config[key] = currentConfig[key];
      }

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
