"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { CareerProfileView } from "@/components/student/career-profile-view";
import { AdminDocumentsClient } from "@/components/admin/admin-documents-client";
import { AdminInterviewsClient } from "@/components/admin/interviews-client";
import { ComplianceView } from "@/components/shared/compliance-view";
import { IncidentsClient } from "@/components/admin/incidents-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Briefcase, Award, FileText, Download } from "lucide-react";
import Link from "next/link";

interface StudentOverview {
  applications: Array<{
    id: string;
    status: string;
    appliedAt: string;
    jobRole: { id: string; title: string; drive: { id: string; title: string; status: string; company: { name: string } } };
  }>;
  offers: Array<{
    id: string;
    category: string;
    type: string;
    ctc: number | null;
    stipend: number | null;
    status: string;
    offerDate: string;
    company: { name: string };
    jobRole: { title: string };
  }>;
  testResults: Array<{
    id: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    isPassed: boolean;
    createdAt: string;
    test: { title: string; testType: { name: string } };
  }>;
  mockInterviews: Array<{
    id: string;
    interviewerName: string;
    scheduledAt: string;
    type: string;
    status: string;
    result: { overallScore: number } | null;
  }>;
  resumes: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    versionCount: number;
    updatedAt: string;
    latestVersion: { version: number; createdAt: string; isGenerated: boolean; fileUrl: string | null } | null;
  }>;
}

/**
 * Admin's unrestricted per-student detail view — Phase 17 P5.
 *
 * "Profile" reuses the student's own CareerProfileView (mode="admin" skips
 * the profile-visibility masking that applies to every other non-self
 * viewer — see app/api/student/profile/career/route.ts). Documents,
 * Interviews, and Compliance reuse their existing admin components scoped
 * by studentId rather than rebuilding a second rendering of the same data.
 * Applications/Offers/SkillUp/Resumes have no prior admin-facing per-student
 * view, so they're rendered here from a small dedicated overview endpoint.
 */
export function StudentDetailClient({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-student-overview", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${studentId}/overview`);
      if (!res.ok) throw new Error("Failed to load student overview");
      return res.json() as Promise<StudentOverview>;
    },
  });

  return (
    <Tabs defaultValue="profile">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="applications">Applications</TabsTrigger>
        <TabsTrigger value="offers">Offers</TabsTrigger>
        <TabsTrigger value="skillup">SkillUp</TabsTrigger>
        <TabsTrigger value="interviews">Mock Interviews</TabsTrigger>
        <TabsTrigger value="resumes">Resumes</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="compliance">Compliance</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <CareerProfileView studentId={studentId} studentName={studentName} mode="admin" />
      </TabsContent>

      <TabsContent value="applications">
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data?.applications.length ? (
          <EmptyState icon={Briefcase} title="No applications yet" />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Drive</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.jobRole.drive.company.name}</TableCell>
                    <TableCell>{a.jobRole.title}</TableCell>
                    <TableCell>
                      <Link href={`/admin/drives/${a.jobRole.drive.id}`} className="text-primary hover:underline">
                        {a.jobRole.drive.title}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(a.appliedAt)}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="offers">
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data?.offers.length ? (
          <EmptyState icon={Award} title="No offers yet" />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>CTC / Stipend</TableHead>
                  <TableHead>Offer Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.company.name}</TableCell>
                    <TableCell>{o.jobRole.title}</TableCell>
                    <TableCell>{o.type.replace(/_/g, " ")}</TableCell>
                    <TableCell>{o.ctc ? `₹${o.ctc} LPA` : o.stipend ? `₹${o.stipend}/mo` : "—"}</TableCell>
                    <TableCell>{formatDate(o.offerDate)}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="skillup">
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data?.testResults.length ? (
          <EmptyState icon={FileText} title="No SkillUp results yet" />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.testResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.test.title}</TableCell>
                    <TableCell>{r.test.testType.name}</TableCell>
                    <TableCell>{r.marksObtained} / {r.maxMarks}</TableCell>
                    <TableCell>{r.percentage.toFixed(1)}%</TableCell>
                    <TableCell><StatusBadge status={r.isPassed ? "PASSED" : "FAILED"} /></TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="interviews">
        <AdminInterviewsClient studentId={studentId} />
      </TabsContent>

      <TabsContent value="resumes">
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data?.resumes.length ? (
          <EmptyState icon={FileText} title="No resumes uploaded" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.resumes.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{r.name}</span>
                    {r.isDefault && <StatusBadge status="VERIFIED" label="Default" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>{r.versionCount} version(s) · last updated {formatDate(r.updatedAt)}</p>
                  {r.latestVersion && (
                    <p>
                      Latest: v{r.latestVersion.version} ({r.latestVersion.isGenerated ? "generated" : "uploaded"}),{" "}
                      {formatDateTime(r.latestVersion.createdAt)}
                    </p>
                  )}
                  {r.latestVersion?.fileUrl && (
                    <a href={r.latestVersion.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3.5 w-3.5" /> View latest version
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="documents">
        <AdminDocumentsClient studentId={studentId} />
      </TabsContent>

      <TabsContent value="compliance">
        <div className="space-y-8">
          <ComplianceView endpoint={`/api/admin/compliance/${studentId}`} studentId={studentId} adminControls />
          <div>
            <h2 className="mb-3 text-lg font-semibold">Incidents</h2>
            <IncidentsClient studentId={studentId} />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
