import { createId, database, ensureProductsSeeded, type JsonRecord } from "./_shared/database";
import { errorResponse, json, methodNotAllowed } from "./_shared/http";

type FunctionContext = {
  params: Record<string, string>;
  requestId?: string;
};

function normalizeProduct(input: JsonRecord, forcedId?: string) {
  const id = forcedId || (typeof input.id === "string" && input.id.trim()) || createId("prod");
  return {
    ...input,
    id,
    rating: Number(input.rating) || 5,
    reviewsCount: Number(input.reviewsCount) || 1,
    specs: input.specs && typeof input.specs === "object" ? input.specs : {},
    tags: Array.isArray(input.tags) ? input.tags : [],
  };
}

async function listProducts() {
  let rows = await database.sql`
    SELECT data, updated_at
    FROM products
    ORDER BY created_at ASC, id ASC
  `;

  if (rows.length === 0) {
    await ensureProductsSeeded();
    rows = await database.sql`
      SELECT data, updated_at
      FROM products
      ORDER BY created_at ASC, id ASC
    `;
  }

  return rows.map((row) => {
    const product = row.data as JsonRecord;
    const image = typeof product.image === "string" ? product.image : "";

    if (!image.startsWith("data:image/")) return product;

    const version = new Date(row.updated_at as string | number | Date).getTime();
    return {
      ...product,
      image: `/api/product-images/${encodeURIComponent(String(product.id))}?v=${version}`,
    };
  });
}

function isGeneratedImagePath(value: unknown) {
  return typeof value === "string" && value.startsWith("/api/product-images/");
}

async function saveProduct(request: Request, id?: string) {
  const input = await request.json() as JsonRecord;
  if (!input.name || !input.category) {
    return json({ error: "اسم المنتج والفئة مطلوبان." }, 400);
  }

  const product = normalizeProduct(input, id);
  const [saved] = await database.sql`
    INSERT INTO products (id, data)
    VALUES (${product.id}, CAST(${JSON.stringify(product)} AS jsonb))
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
    RETURNING data
  `;
  return json(saved.data);
}

async function updateProduct(request: Request, id: string) {
  const input = await request.json() as JsonRecord;
  const [existing] = await database.sql`SELECT data FROM products WHERE id = ${id}`;
  if (!existing) return json({ error: "المنتج غير موجود." }, 404);

  if (isGeneratedImagePath(input.image)) delete input.image;

  return saveProduct(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...existing.data, ...input, id }),
  }), id);
}

async function deleteProduct(id: string) {
  const deleted = await database.sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
  if (deleted.length === 0) return json({ error: "المنتج غير موجود." }, 404);
  return json({ deleted: true, id });
}

async function saveBulk(request: Request) {
  const body = await request.json() as { products?: JsonRecord[]; replaceAll?: boolean };
  if (!Array.isArray(body.products)) {
    return json({ error: "المنتجات يجب أن تكون مصفوفة." }, 400);
  }

  const products = body.products.map((product) => normalizeProduct(product));
  const client = await database.pool.connect();
  try {
    await client.query("BEGIN");
    if (body.replaceAll) await client.query("DELETE FROM products");
    if (products.length > 0) {
      await client.query(
        `INSERT INTO products (id, data)
         SELECT product->>'id', product
         FROM jsonb_array_elements($1::jsonb) AS product
         ON CONFLICT (id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(products)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return json({ count: products.length });
}

export default async function handler(request: Request, context: FunctionContext) {
  const url = new URL(request.url);
  const id = context.params.id;
  const isBulk = url.pathname.endsWith("/bulk");

  try {
    let response: Response;
    if (request.method === "GET" && !id && !isBulk) {
      const forceRefresh = url.searchParams.has("refresh");
      response = json(await listProducts(), 200, forceRefresh ? {
        "Cache-Control": "no-store, max-age=0",
      } : {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        "Netlify-CDN-Cache-Control": "public, durable, max-age=60, stale-while-revalidate=300",
      });
    }
    else if (request.method === "POST" && isBulk) response = await saveBulk(request);
    else if (request.method === "POST" && !id) response = await saveProduct(request);
    else if (request.method === "PUT" && id) response = await updateProduct(request, id);
    else if (request.method === "DELETE" && id) response = await deleteProduct(id);
    else return methodNotAllowed(["GET", "POST", "PUT", "DELETE"]);

    console.log("database_operation_succeeded", {
      resource: "products",
      method: request.method,
      id: id || null,
      requestId: context.requestId,
      status: response.status,
    });
    return response;
  } catch (error) {
    return errorResponse(error, `products:${request.method}`, context.requestId);
  }
}

export const config = {
  path: ["/api/products", "/api/products/bulk", "/api/products/:id"],
};
