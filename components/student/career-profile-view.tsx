"use client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ProfileCompletionWidget } from "./profile-completion-widget";
import {
  GraduationCap, MapPin, Mail, Phone, GitBranch, ExternalLink,
  Briefcase, FolderGit2, Award, Trophy, Video, CheckCircle, Clock, XCircle,
  Code2, Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const SKILL_LEVEL_COLORS: Record<string, "info" | "success" | "warning" | "default"> = {
  BEGINNER: "info", INTERMEDIATE: "success", ADVANCED: "warning", EXPERT: "default",
};

const ACHIEVEMENT_TYPE_LABELS: Record<string, string> = {
  HACKATHON: "Hackathon", COMPETITION: "Competition", ACADEMIC: "Academic",
  SPORTS: "Sports", LEADERSHIP: "Leadership", AWARD: "Award",
  RESEARCH: "Research", EXTRACURRICULAR: "Extracurricular",
};

const PLATFORM_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn", GITHUB: "GitHub", PORTFOLIO: "Portfolio",
  LEETCODE: "LeetCode", CODECHEF: "CodeChef", HACKERRANK: "HackerRank",
  KAGGLE: "Kaggle", CODEFORCES: "Codeforces", CUSTOM: "Custom",
};

async function fetchCareerProfile() {
  const res = await fetch("/api/student/profile/career");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

interface Props { studentId: string; studentName: string; }

export function CareerProfileView({ studentId, studentName }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["career-profile", studentId],
    queryFn: fetchCareerProfile,
  });

  if (isLoading) return <LoadingState text="Assembling your profile..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const p = data;

  return (
    <div className="space-y-6">
      {/* Completion widget */}
      <ProfileCompletionWidget />

      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
              {(p.personal?.firstName?.[0] ?? p.name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{p.personal?.firstName} {p.personal?.middleName} {p.personal?.lastName}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{p.branch?.name} · {p.batch?.academicYear}</p>
              <p className="text-muted-foreground text-sm">{p.branch?.department?.name}</p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {p.personal?.phoneNumber && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.personal.phoneNumber}</span>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" />{p.email}
                  </a>
                )}
                {p.address?.currentCity && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{p.address.currentCity}, {p.address.currentState}</span>
                )}
              </div>

              {/* Social profiles inline */}
              {(p.socialProfiles?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.socialProfiles.map((s: any) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors">
                      <ExternalLink className="h-3 w-3" />{PLATFORM_LABELS[s.platform] ?? s.platform}
                      {s.username && <span className="text-muted-foreground">@{s.username}</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <Badge variant={p.profileStatus === "VERIFIED" ? "success" : p.profileStatus === "PENDING_VERIFICATION" ? "warning" : "secondary"}>
                {p.profileStatus?.replace(/_/g, " ")}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">#{p.enrollmentNumber}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* Academic */}
          {p.academic && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />Academic Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 sm:grid-cols-3 text-sm">
                  {p.academic.currentCgpa !== undefined && (
                    <div><dt className="text-muted-foreground">CGPA</dt><dd className="font-bold text-lg mt-0.5">{p.academic.currentCgpa?.toFixed(2)}</dd></div>
                  )}
                  <div><dt className="text-muted-foreground">Semester</dt><dd className="font-semibold mt-0.5">{p.academic.currentSemester}</dd></div>
                  {p.academic.activeBacklogs !== undefined && (
                    <div><dt className="text-muted-foreground">Active Backlogs</dt><dd className={`font-semibold mt-0.5 ${p.academic.activeBacklogs > 0 ? "text-destructive" : "text-emerald-600"}`}>{p.academic.activeBacklogs}</dd></div>
                  )}
                </dl>
                {/* SGPA chart-lite: simple table */}
                {(p.academic.sgpaRecords?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Semester GPA</p>
                    <div className="flex flex-wrap gap-2">
                      {p.academic.sgpaRecords.map((r: any) => (
                        <div key={r.semester} className="flex flex-col items-center rounded-lg border bg-muted/30 px-3 py-2 text-center min-w-[52px]">
                          <span className="text-xs text-muted-foreground">Sem {r.semester}</span>
                          <span className="font-bold text-sm mt-0.5">{r.sgpa.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <dl className="grid gap-3 sm:grid-cols-2 text-sm border-t pt-3">
                  <div><dt className="text-muted-foreground">10th</dt><dd className="mt-0.5">{p.academic.tenthBoard} · {p.academic.tenthPercentage}% ({p.academic.tenthYear})</dd></div>
                  <div><dt className="text-muted-foreground">12th</dt><dd className="mt-0.5">{p.academic.twelfthBoard} · {p.academic.twelfthPercentage}% ({p.academic.twelfthYear})</dd></div>
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {p.skills && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5 text-primary" />Skills</CardTitle></CardHeader>
              <CardContent>
                {(p.skills.catalogSkills?.length ?? 0) === 0 && (p.skills.customSkills?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No skills added yet. <Link href="/student/profile/skills" className="text-primary hover:underline">Add skills →</Link></p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {p.skills.catalogSkills?.map((s: any) => (
                      <span key={s.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-sm">
                        {s.skill.name}
                        <Badge variant={SKILL_LEVEL_COLORS[s.level]} className="text-[10px] px-1.5 py-0">{s.level}</Badge>
                      </span>
                    ))}
                    {p.skills.customSkills?.map((s: any) => (
                      <span key={s.id} className="flex items-center gap-1.5 rounded-full border bg-amber-50 px-3 py-1.5 text-sm">
                        <Sparkles className="h-3 w-3 text-amber-500" />{s.name}
                        <Badge variant={SKILL_LEVEL_COLORS[s.level]} className="text-[10px] px-1.5 py-0">{s.level}</Badge>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Projects */}
          {p.projects !== undefined && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FolderGit2 className="h-5 w-5 text-primary" />Projects</CardTitle></CardHeader>
              <CardContent>
                {(p.projects?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects added. <Link href="/student/profile/projects" className="text-primary hover:underline">Add projects →</Link></p>
                ) : (
                  <div className="space-y-4">
                    {p.projects.map((proj: any) => (
                      <div key={proj.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{proj.title}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {proj.githubUrl && <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><GitBranch className="h-4 w-4" /></a>}
                            {proj.liveUrl && <a href={proj.liveUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {proj.startDate ? formatDate(new Date(proj.startDate)) : ""}{" "}
                          {proj.isOngoing ? "— Present" : proj.endDate ? `— ${formatDate(new Date(proj.endDate))}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">{proj.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {proj.techStack?.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Internships */}
          {p.internships !== undefined && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Internships & Experience</CardTitle></CardHeader>
              <CardContent>
                {(p.internships?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No experience added. <Link href="/student/profile/internships" className="text-primary hover:underline">Add experience →</Link></p>
                ) : (
                  <div className="space-y-4">
                    {p.internships.map((i: any) => (
                      <div key={i.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <p className="font-semibold">{i.role}</p>
                        <p className="text-sm text-muted-foreground">{i.company}{i.location ? ` · ${i.location}` : ""}{i.isRemote ? " · Remote" : ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(new Date(i.startDate))} — {i.isOngoing ? "Present" : i.endDate ? formatDate(new Date(i.endDate)) : "—"}
                        </p>
                        {i.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{i.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Certifications */}
          {p.certifications !== undefined && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-primary" />Certifications</CardTitle></CardHeader>
              <CardContent>
                {(p.certifications?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">None added. <Link href="/student/profile/certifications" className="text-primary hover:underline">Add →</Link></p>
                ) : (
                  <ul className="space-y-3">
                    {p.certifications.map((c: any) => (
                      <li key={c.id} className="border-b pb-3 last:border-0 last:pb-0">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.issuingOrg} · {formatDate(new Date(c.issueDate))}</p>
                        {c.credentialUrl && (
                          <a href={c.credentialUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                            <ExternalLink className="h-3 w-3" />Verify
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Achievements */}
          {p.achievements !== undefined && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-primary" />Achievements</CardTitle></CardHeader>
              <CardContent>
                {(p.achievements?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">None added. <Link href="/student/profile/achievements" className="text-primary hover:underline">Add →</Link></p>
                ) : (
                  <ul className="space-y-3">
                    {p.achievements.map((a: any) => (
                      <li key={a.id} className="border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{a.title}</p>
                          <Badge variant="secondary" className="text-[10px]">{ACHIEVEMENT_TYPE_LABELS[a.type]}</Badge>
                        </div>
                        {a.position && <p className="text-xs font-semibold text-amber-600 mt-0.5">{a.position}</p>}
                        {(a.organizer || a.date) && (
                          <p className="text-xs text-muted-foreground">{a.organizer}{a.date ? ` · ${formatDate(new Date(a.date))}` : ""}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Video profile */}
          {p.videoProfile !== undefined && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Video className="h-4 w-4 text-primary" />Video Introduction</CardTitle></CardHeader>
              <CardContent>
                {!p.videoProfile || p.videoProfile.status === "NOT_UPLOADED" ? (
                  <p className="text-sm text-muted-foreground">Not uploaded. <Link href="/student/profile/social" className="text-primary hover:underline">Add video →</Link></p>
                ) : (
                  <div className="space-y-2">
                    <Badge variant={p.videoProfile.status === "VERIFIED" ? "success" : p.videoProfile.status === "PENDING_VERIFICATION" ? "warning" : "destructive"} className="gap-1">
                      {p.videoProfile.status === "VERIFIED" && <CheckCircle className="h-3 w-3" />}
                      {p.videoProfile.status === "PENDING_VERIFICATION" && <Clock className="h-3 w-3" />}
                      {p.videoProfile.status === "REJECTED" && <XCircle className="h-3 w-3" />}
                      {p.videoProfile.status.replace(/_/g, " ")}
                    </Badge>
                    {p.videoProfile.status === "VERIFIED" && p.videoProfile.videoFileUrl && (
                      <video src={p.videoProfile.videoFileUrl} controls className="w-full rounded-lg mt-2" />
                    )}
                    {p.videoProfile.status === "VERIFIED" && p.videoProfile.videoUrl && !p.videoProfile.videoFileUrl && (
                      <a href={p.videoProfile.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Watch Video →</a>
                    )}
                    {p.videoProfile.adminNote && p.videoProfile.status === "REJECTED" && (
                      <p className="text-xs text-destructive mt-1">Note: {p.videoProfile.adminNote}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
