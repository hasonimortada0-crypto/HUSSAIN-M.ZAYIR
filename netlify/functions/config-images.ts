import { database } from "./_shared/database";
import { errorResponse, json, methodNotAllowed } from "./_shared/http";

type FunctionContext = {
  params: Record<string, string>;
  requestId?: string;
};

const allowedKeys = new Set(["heroImage", "slide1", "slide2", "slide3"]);

export default async function handler(request: Request, context: FunctionContext) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);

  try {
    const key = context.params.key;
    if (!allowedKeys.has(key)) return json({ error: "الصورة غير موجودة." }, 404);

    const [row] = await database.sql`SELECT data->>${key} AS image FROM store_config WHERE id = ${"store"}`;
    const image = row?.image;

    if (typeof image !== "string" || !image) return json({ error: "الصورة غير موجودة." }, 404);

    if (/^https?:\/\//i.test(image)) {
      return new Response(null, {
        status: 302,
        headers: { Location: image, "Cache-Control": "public, max-age=3600" },
      });
    }

    const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
    if (!match) return json({ error: "صيغة الصورة غير مدعومة." }, 415);

    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": match[1],
        "Content-Length": String(Buffer.byteLength(match[2], "base64")),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Netlify-CDN-Cache-Control": "public, durable, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, `config-image:${request.method}`, context.requestId);
  }
}

export const config = { path: "/api/config-images/:key" };
