import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata = { title: "Complete Your Profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: {
      branch: { include: { department: true, course: true } },
      batch: true,
      academicRecord: { include: { sgpaRecords: { orderBy: { semester: "asc" } } } },
    },
  });

  if (!student) redirect("/login");
  if (student.onboardingStep >= 2) redirect("/student/dashboard");

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center pt-10 pb-16 px-4">
      <OnboardingWizard
        initialStep={student.onboardingStep}
        student={student}
        enrollmentNumber={student.enrollmentNumber}
        branchName={student.branch.name}
        batchYear={student.batch.academicYear}
      />
    </div>
  );
}
