/**
 * Individual student account provisioning — Phase 17 P4.
 * POST - create one student's User+Student record and email them a
 *        "set your password" link (no plaintext password is ever returned).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { createStudentAccount } from "@/server/services/student.service";
import { createStudentSchema } from "@/lib/validations/admin";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("student:write:all");
    const data = createStudentSchema.parse(await request.json());
    const student = await createStudentAccount(data, actor.id as string, extractRequestMeta(request));
    return NextResponse.json({ message: "Student account created", student });
  } catch (error) {
    return handleApiError(error);
  }
}
