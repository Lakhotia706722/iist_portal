"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Target,
  ListChecks,
  Briefcase,
  Compass,
  Mic2,
  Info,
  CheckCircle2,
} from "lucide-react";

type MatchResult = {
  score: number;
  breakdown: {
    skills: { score: number; matched: string[]; missing: string[] };
    projects: { score: number; note: string };
    experience: { score: number; note: string };
    education: { score: number; note: string };
    keywords: { score: number; matched: string[]; missing: string[] };
  };
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
};

type SkillGap = {
  requiredSkills: string[];
  preferredSkills: string[];
  have: string[];
  missingRequired: string[];
  missingPreferred: string[];
  coveragePercent: number;
};

type DraftBullet = {
  id: string;
  section: string;
  text: string;
  sourceFact: string;
  traced: boolean;
};

type DraftResult = {
  targetRole: string;
  bullets: DraftBullet[];
  droppedCount: number;
  totalFacts: number;
};

type JobRecommendation = {
  jobRoleId: string;
  driveId: string;
  title: string;
  companyName: string;
  matchScore: number;
  matchedSkills: string[];
};

type CareerRecommendation = {
  title: string;
  rationale: string;
  suggestedSkills: string[];
};

type InterviewFeedback = {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  questionFeedback: Array<{ question: string; feedback: string; score: number }>;
};

function AIDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{score}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

async function postAI<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export function AIResumeBuilderClient() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [jd, setJd] = useState("");
  const [targetRole, setTargetRole] = useState("");

  // Match score
  const matchMutation = useMutation({
    mutationFn: () => postAI<{ result: MatchResult }>("/api/student/ai/resume-match", { jobDescription: jd }),
    onError: (e: Error) => toast({ title: "Match failed", description: e.message, variant: "destructive" }),
  });

  // Skill gap
  const gapMutation = useMutation({
    mutationFn: () => postAI<{ result: SkillGap }>("/api/student/ai/skill-gap", { jobDescription: jd }),
    onError: (e: Error) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });

  // Draft
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [resumeId, setResumeId] = useState("");
  const draftMutation = useMutation({
    mutationFn: () =>
      postAI<{ result: DraftResult }>("/api/student/ai/resume-draft", { targetRole, jobDescription: jd }),
    onSuccess: (data) => setApproved(new Set(data.result.bullets.map((b) => b.id))),
    onError: (e: Error) => toast({ title: "Draft failed", description: e.message, variant: "destructive" }),
  });

  const resumesQuery = useQuery({
    queryKey: ["resumes-for-ai"],
    queryFn: async () => {
      const res = await fetch("/api/student/resumes");
      if (!res.ok) return { resumes: [] };
      const body = await res.json();
      // GET /api/student/resumes returns the array directly.
      return { resumes: Array.isArray(body) ? body : (body.resumes ?? body.items ?? []) };
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      const bullets = (draftMutation.data?.result.bullets ?? []).filter((b) => approved.has(b.id));
      return postAI<{ message: string; savedCount: number; droppedCount: number }>(
        "/api/student/ai/resume-draft/approve",
        { resumeId, targetRole, bullets: bullets.map(({ section, text, sourceFact }) => ({ section, text, sourceFact })) }
      );
    },
    onSuccess: (data) => {
      toast({ title: "Resume version saved", description: data.message, variant: "success" });
      qc.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // Job recommendations
  const jobRecsQuery = useQuery({
    queryKey: ["ai-job-recs"],
    queryFn: async () => {
      const res = await fetch("/api/student/ai/job-recommendations");
      if (!res.ok) throw new Error("Failed to load recommendations");
      return res.json() as Promise<{ recommendations: JobRecommendation[] }>;
    },
  });

  // Career recommendations
  const [interests, setInterests] = useState("");
  const careerMutation = useMutation({
    mutationFn: () => postAI<{ recommendations: CareerRecommendation[] }>("/api/student/ai/career-recommendations", { interests }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Interview practice
  const [practiceQ, setPracticeQ] = useState("");
  const [practiceA, setPracticeA] = useState("");
  const practiceMutation = useMutation({
    mutationFn: () => postAI<{ feedback: InterviewFeedback }>("/api/student/ai/interview-practice", { question: practiceQ, answer: practiceA }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <AIDisclaimer>
        Everything on this page is AI-generated guidance for you to review — nothing is saved to your
        profile or resume automatically. Resume bullets are drafted only from your verified profile
        data (skills, projects, internships, certifications, achievements); anything the AI can&apos;t trace
        back to your real profile is dropped before you ever see it.
      </AIDisclaimer>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Target role" htmlFor="ai-role" className="sm:col-span-1">
            <Input id="ai-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="SDE-1" />
          </FormField>
          <FormField label="Job description" htmlFor="ai-jd" className="sm:col-span-2">
            <Textarea id="ai-jd" rows={4} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description here…" />
          </FormField>
        </div>
      </Card>

      <Tabs defaultValue="match">
        <TabsList className="flex-wrap">
          <TabsTrigger value="match"><Target className="mr-1.5 h-4 w-4" />Match Score</TabsTrigger>
          <TabsTrigger value="gap"><ListChecks className="mr-1.5 h-4 w-4" />Skill Gap</TabsTrigger>
          <TabsTrigger value="draft"><Sparkles className="mr-1.5 h-4 w-4" />Resume Draft</TabsTrigger>
          <TabsTrigger value="jobs"><Briefcase className="mr-1.5 h-4 w-4" />Job Matches</TabsTrigger>
          <TabsTrigger value="career"><Compass className="mr-1.5 h-4 w-4" />Career Advice</TabsTrigger>
          <TabsTrigger value="practice"><Mic2 className="mr-1.5 h-4 w-4" />Interview Practice</TabsTrigger>
        </TabsList>

        {/* Match score */}
        <TabsContent value="match" className="space-y-4 pt-4">
          <Button disabled={jd.length < 20 || matchMutation.isPending} onClick={() => matchMutation.mutate()}>
            {matchMutation.isPending ? "Scoring…" : "Get match score"}
          </Button>
          {matchMutation.data && (
            <Card className="space-y-4 p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{matchMutation.data.result.score}</span>
                <span className="text-muted-foreground">/ 100 overall match</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ScoreBar label="Skills" score={matchMutation.data.result.breakdown.skills.score} />
                <ScoreBar label="Keywords" score={matchMutation.data.result.breakdown.keywords.score} />
                <ScoreBar label="Projects" score={matchMutation.data.result.breakdown.projects.score} />
                <ScoreBar label="Experience" score={matchMutation.data.result.breakdown.experience.score} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Matched skills</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {matchMutation.data.result.matchedSkills.map((s) => (
                      <Badge key={s} variant="success">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Missing skills</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {matchMutation.data.result.missingSkills.map((s) => (
                      <Badge key={s} variant="destructive">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              {matchMutation.data.result.suggestions.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Suggestions</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    {matchMutation.data.result.suggestions.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* Skill gap */}
        <TabsContent value="gap" className="space-y-4 pt-4">
          <Button disabled={jd.length < 20 || gapMutation.isPending} onClick={() => gapMutation.mutate()}>
            {gapMutation.isPending ? "Analyzing…" : "Analyze skill gap"}
          </Button>
          {gapMutation.data && (
            <Card className="space-y-4 p-5">
              <ScoreBar label="Coverage" score={gapMutation.data.result.coveragePercent} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Missing — required</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {gapMutation.data.result.missingRequired.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None — you&apos;re covered.</span>
                    ) : (
                      gapMutation.data.result.missingRequired.map((s) => <Badge key={s} variant="destructive">{s}</Badge>)
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Missing — preferred</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {gapMutation.data.result.missingPreferred.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None.</span>
                    ) : (
                      gapMutation.data.result.missingPreferred.map((s) => <Badge key={s} variant="warning">{s}</Badge>)
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Draft */}
        <TabsContent value="draft" className="space-y-4 pt-4">
          <Button
            disabled={jd.length < 20 || targetRole.length < 2 || draftMutation.isPending}
            onClick={() => draftMutation.mutate()}
          >
            {draftMutation.isPending ? "Drafting…" : "Generate resume draft"}
          </Button>

          {draftMutation.data && (
            <div className="space-y-4">
              {draftMutation.data.result.droppedCount > 0 && (
                <AIDisclaimer>
                  {draftMutation.data.result.droppedCount} suggested item(s) could not be traced back to
                  your verified profile and were removed automatically. Add that information to your
                  profile first if you&apos;d like it included.
                </AIDisclaimer>
              )}
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">
                  Review each bullet below. Only checked bullets will be saved — every one is traced to a
                  specific item in your verified profile, shown underneath.
                </p>
                <ul className="mt-4 space-y-3">
                  {draftMutation.data.result.bullets.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-input"
                        checked={approved.has(b.id)}
                        onChange={() =>
                          setApproved((prev) => {
                            const next = new Set(prev);
                            next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                            return next;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase">{b.section}</Badge>
                        </div>
                        <p className="mt-1 text-sm">{b.text}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Traced to: {b.sourceFact}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                  <FormField label="Save into resume" htmlFor="ai-resume-target" className="min-w-[220px]">
                    <Select id="ai-resume-target" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                      <option value="">Choose a resume…</option>
                      {(resumesQuery.data?.resumes ?? []).map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                  </FormField>
                  <Button
                    disabled={!resumeId || approved.size === 0 || approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    {approveMutation.isPending ? "Saving…" : `Save ${approved.size} approved bullet(s)`}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Job recommendations */}
        <TabsContent value="jobs" className="space-y-4 pt-4">
          {jobRecsQuery.isLoading ? (
            <LoadingState text="Finding matches…" />
          ) : (jobRecsQuery.data?.recommendations.length ?? 0) === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No matches yet"
              description="Add skills to your profile, or check back once more drives open — matches are ranked from your verified skills against real open roles."
            />
          ) : (
            <div className="space-y-3">
              {jobRecsQuery.data!.recommendations.map((r) => (
                <Card key={r.jobRoleId} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-muted-foreground">{r.companyName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.matchedSkills.map((s) => <Badge key={s} variant="success" className="text-[10px]">{s}</Badge>)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums">{r.matchScore}%</p>
                    <p className="text-xs text-muted-foreground">skill match</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Career recommendations */}
        <TabsContent value="career" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Interests (optional)" htmlFor="ai-interests" className="min-w-[260px] flex-1">
              <Input id="ai-interests" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g. distributed systems, robotics" />
            </FormField>
            <Button disabled={careerMutation.isPending} onClick={() => careerMutation.mutate()}>
              {careerMutation.isPending ? "Thinking…" : "Get career recommendations"}
            </Button>
          </div>
          {careerMutation.data && (
            <div className="space-y-3">
              {careerMutation.data.recommendations.map((r, i) => (
                <Card key={i} className="p-4">
                  <p className="font-medium">{r.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.suggestedSkills.map((s) => <Badge key={s} variant="info" className="text-[10px]">{s}</Badge>)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Interview practice */}
        <TabsContent value="practice" className="space-y-4 pt-4">
          <Card className="space-y-4 p-5">
            <FormField label="Interview question" htmlFor="ai-practice-q">
              <Input id="ai-practice-q" value={practiceQ} onChange={(e) => setPracticeQ(e.target.value)} placeholder="Tell me about a challenging project." />
            </FormField>
            <FormField label="Your answer" htmlFor="ai-practice-a">
              <Textarea id="ai-practice-a" rows={5} value={practiceA} onChange={(e) => setPracticeA(e.target.value)} />
            </FormField>
            <Button
              disabled={practiceQ.length < 5 || practiceA.length < 5 || practiceMutation.isPending}
              onClick={() => practiceMutation.mutate()}
            >
              {practiceMutation.isPending ? "Evaluating…" : "Get feedback"}
            </Button>
          </Card>
          {practiceMutation.data && (
            <Card className="space-y-4 p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{practiceMutation.data.feedback.overallScore}</span>
                <span className="text-muted-foreground">/ 100</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Strengths</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {practiceMutation.data.feedback.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Areas to improve</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {practiceMutation.data.feedback.areasForImprovement.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
