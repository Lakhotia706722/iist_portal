import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SkillUpResultDetail } from "@/components/student/skillup-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Test Result" };

export default function StudentTestResultPage({
  params,
}: {
  params: { testId: string };
}) {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student/skillup">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to SkillUp
        </Link>
      </Button>
      <PageHeader title="Test Result" description="Your detailed result for this assessment." />
      <SkillUpResultDetail testId={params.testId} />
    </div>
  );
}
