import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { PersonalAcademicProfile } from "@/components/student/personal-academic-profile";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Personal & Academic Info" };

export default async function StudentProfilePage() {
  const session = await auth();
  if (!session?.user?.studentId) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal & Academic Info"
        description="Update the details you filled in during onboarding at any time."
      />
      <PersonalAcademicProfile />
    </div>
  );
}
