/**
 * Individual student account provisioning — Phase 17 P4, extended Phase 18 P1.
 * POST - create one student's User+Student record. deliveryMethod "direct"
 *        (default) returns the plaintext password once in the response for
 *        a one-time admin reveal; "email" sends a "set your password" link
 *        instead and never returns a password.
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
