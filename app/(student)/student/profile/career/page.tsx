import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CareerProfileView } from "@/components/student/career-profile-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career Profile" };

export default async function CareerProfilePage() {
  const session = await auth();
  if (!session?.user?.studentId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: session.user.studentId },
    select: { id: true, firstName: true, lastName: true },
  });

  return <CareerProfileView studentId={session.user.studentId} studentName={`${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim()} />;
}
