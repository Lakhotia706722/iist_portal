import { PageHeader } from "@/components/shared/page-header";
import { VideoVerificationClient } from "@/components/admin/video-verification-client";

export const metadata = { title: "Video Profile Verification" };

export default function VideoProfilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Video Profile Verification" description="Review and verify student video introductions." />
      <VideoVerificationClient />
    </div>
  );
}
