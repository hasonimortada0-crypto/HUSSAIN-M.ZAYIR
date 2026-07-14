import { createId, database, type JsonRecord } from "./_shared/database";
import { errorResponse, json, methodNotAllowed } from "./_shared/http";

type FunctionContext = {
  params: Record<string, string>;
  requestId?: string;
};

export default async function handler(request: Request, context: FunctionContext) {
  const id = context.params.id;

  try {
    let response: Response;
    if (request.method === "GET" && !id) {
      const rows = await database.sql`
        SELECT data FROM orders ORDER BY created_at DESC
      `;
      response = json(rows.map((row) => row.data));
    } else if (request.method === "POST" && !id) {
      const input = await request.json() as JsonRecord;
      if (!input.customerName || !input.customerPhone || !input.customerAddress) {
        return json({ error: "معلومات العميل مطلوبة." }, 400);
      }
      const order = {
        ...input,
        id: createId("order"),
        status: "قيد المعالجة",
        createdAt: new Date().toISOString(),
      };
      const [saved] = await database.sql`
        INSERT INTO orders (id, data)
        VALUES (${order.id}, CAST(${JSON.stringify(order)} AS jsonb))
        RETURNING data
      `;
      response = json(saved.data, 201);
    } else if (request.method === "PUT" && id) {
      const input = await request.json() as JsonRecord;
      const [existing] = await database.sql`SELECT data FROM orders WHERE id = ${id}`;
      if (!existing) return json({ error: "الطلب غير موجود." }, 404);
      const order = { ...existing.data, ...input, id };
      const [saved] = await database.sql`
        UPDATE orders
        SET data = CAST(${JSON.stringify(order)} AS jsonb), updated_at = NOW()
        WHERE id = ${id}
        RETURNING data
      `;
      response = json(saved.data);
    } else if (request.method === "DELETE" && id) {
      const deleted = await database.sql`DELETE FROM orders WHERE id = ${id} RETURNING id`;
      response = deleted.length ? json({ deleted: true, id }) : json({ error: "الطلب غير موجود." }, 404);
    } else {
      return methodNotAllowed(["GET", "POST", "PUT", "DELETE"]);
    }

    console.log("database_operation_succeeded", {
      resource: "orders",
      method: request.method,
      id: id || null,
      requestId: context.requestId,
      status: response.status,
    });
    return response;
  } catch (error) {
    return errorResponse(error, `orders:${request.method}`, context.requestId);
  }
}

export const config = { path: ["/api/orders", "/api/orders/:id"] };
