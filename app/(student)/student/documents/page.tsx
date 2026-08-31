import { PageHeader } from "@/components/shared/page-header";
import { DocumentsClient } from "@/components/student/documents-client";

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage your identity documents, marksheets and certificates for admin verification."
      />
      <DocumentsClient />
    </div>
  );
}
