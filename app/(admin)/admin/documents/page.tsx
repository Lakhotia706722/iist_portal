import { PageHeader } from "@/components/shared/page-header";
import { AdminDocumentsClient } from "@/components/admin/admin-documents-client";

export const metadata = { title: "Document Verification" };

export default function AdminDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Document Verification" description="Review, verify and manage student-uploaded documents." />
      <AdminDocumentsClient />
    </div>
  );
}
