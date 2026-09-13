import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StudentDetailClient } from "@/components/admin/student-detail-client";
import { getStudentProfile } from "@/server/services/student.service";

export const metadata = { title: "Student Detail" };

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let student;
  try {
    student = await getStudentProfile(params.id);
  } catch {
    notFound();
  }

  const name = [student.firstName, student.lastName].filter(Boolean).join(" ") || student.enrollmentNumber;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={`#${student.enrollmentNumber} · ${student.branch.name} · ${student.batch.name}`}
      />
      <StudentDetailClient studentId={student.id} studentName={name} />
    </div>
  );
}
