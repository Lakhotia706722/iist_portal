/**
 * Bulk student account provisioning via CSV — Phase 17 P4.
 * POST - client parses the .csv into rows and posts them as JSON (same
 *        convention as SkillUp's results upload and drive CSV shortlisting;
 *        see skillup.service.ts's uploadResults). All-or-nothing: any bad
 *        row rejects the whole batch with row-level errors, nothing partial
 *        is ever written.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { bulkCreateStudentAccounts } from "@/server/services/student.service";
import { bulkCreateStudentsSchema } from "@/lib/validations/admin";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("student:write:all");
    const data = bulkCreateStudentsSchema.parse(await request.json());
    const result = await bulkCreateStudentAccounts(data.rows, actor.id as string, extractRequestMeta(request));

    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          error: `${result.errors.length} row(s) failed validation - no accounts were created`,
          errors: result.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ message: `${result.created} student account(s) created`, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
