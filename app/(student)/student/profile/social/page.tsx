import { PageHeader } from "@/components/shared/page-header";
import { SocialProfilesClient } from "@/components/student/social-profiles-client";
import { VideoProfileClient } from "@/components/student/video-profile-client";

export const metadata = { title: "Social Profiles & Video" };

export default function SocialPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader
          title="Social Profiles"
          description="Link your professional and coding profiles."
        />
        <SocialProfilesClient />
      </div>
      <div className="space-y-6">
        <PageHeader
          title="Video Profile"
          description="Upload a 60-second video introduction or link a YouTube / Google Drive URL."
        />
        <VideoProfileClient />
      </div>
    </div>
  );
}
