export const jsonHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: jsonHeaders });
}

export function methodNotAllowed(allowed: string[]) {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...jsonHeaders, Allow: allowed.join(", ") },
  });
}

export function errorResponse(error: unknown, operation: string, requestId?: string) {
  console.error("database_operation_failed", {
    operation,
    requestId,
    message: error instanceof Error ? error.message : "Unknown error",
  });
  return json({ error: "تعذر إكمال العملية في قاعدة البيانات." }, 500);
}
