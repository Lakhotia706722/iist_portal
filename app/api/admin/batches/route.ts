import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { batchSchema } from "@/lib/validations/admin";
import { createBatch, listBatches } from "@/server/services/batch.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("batch:read");
    const { searchParams } = req.nextUrl;
    return Response.json(await listBatches({ search: searchParams.get("search") ?? undefined, branchId: searchParams.get("branchId") ?? undefined, page: Number(searchParams.get("page") ?? 1), pageSize: Number(searchParams.get("pageSize") ?? 50) }));
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("batch:write");
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await createBatch(parsed.data, actor.id), { status: 201 });
  } catch (err) { return errorResponse(err); }
}
