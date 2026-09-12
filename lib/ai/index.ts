/**
 * AI Service Abstraction — Phase 5
 *
 * AI output is ALWAYS staged for student review — nothing here writes
 * directly to verified profile data, and generated resume content is
 * filtered server-side against the student's actual verified profile facts
 * before it ever reaches the client (see server/services/ai-resume.service.ts
 * `enforceTraceability`). The AI is asked to cite its sources; the code does
 * not trust that citation without checking it.
 */

export interface ResumeMatchBreakdown {
  skills: { score: number; matched: string[]; missing: string[] };
  projects: { score: number; note: string };
  experience: { score: number; note: string };
  education: { score: number; note: string };
  keywords: { score: number; matched: string[]; missing: string[] };
}

export interface ResumeMatchResult {
  score: number; // 0-100 overall
  breakdown: ResumeMatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
}

export interface JDAnalysisResult {
  requiredSkills: string[];
  preferredSkills: string[];
  minCgpa?: number;
  keywords: string[];
  summary: string;
}

export interface ResumeImprovementSuggestion {
  section: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
}

export interface MockInterviewFeedback {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  questionFeedback: Array<{
    question: string;
    feedback: string;
    score: number;
  }>;
}

/** One AI-drafted resume bullet, with the verified fact it claims to be based on. */
export interface DraftBullet {
  section: "summary" | "skills" | "projects" | "experience" | "certifications" | "achievements";
  text: string;
  sourceFact: string;
}

export interface CareerRecommendation {
  title: string;
  rationale: string;
  suggestedSkills: string[];
}

export interface AIProvider {
  generateResumeMatch(
    resumeText: string,
    jobDescription: string,
    userId: string
  ): Promise<ResumeMatchResult>;
  analyzeJD(jobDescription: string, userId: string): Promise<JDAnalysisResult>;
  suggestImprovements(resumeText: string, userId: string): Promise<ResumeImprovementSuggestion[]>;
  mockInterviewFeedback(
    question: string,
    answer: string,
    userId: string
  ): Promise<MockInterviewFeedback>;
  /** Draft resume bullets from a fixed list of verified facts — must not invent facts. */
  draftResumeBullets(
    verifiedFacts: string[],
    targetRole: string,
    jobDescription: string,
    userId: string
  ): Promise<DraftBullet[]>;
  careerRecommendations(
    verifiedFacts: string[],
    interests: string | undefined,
    userId: string
  ): Promise<CareerRecommendation[]>;
}

class StubAIProvider implements AIProvider {
  async generateResumeMatch(): Promise<ResumeMatchResult> {
    throw new Error("AI provider not configured. Set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY.");
  }
  async analyzeJD(): Promise<JDAnalysisResult> {
    throw new Error("AI provider not configured.");
  }
  async suggestImprovements(): Promise<ResumeImprovementSuggestion[]> {
    throw new Error("AI provider not configured.");
  }
  async mockInterviewFeedback(): Promise<MockInterviewFeedback> {
    throw new Error("AI provider not configured.");
  }
  async draftResumeBullets(): Promise<DraftBullet[]> {
    throw new Error("AI provider not configured.");
  }
  async careerRecommendations(): Promise<CareerRecommendation[]> {
    throw new Error("AI provider not configured.");
  }
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;
  const provider = process.env.AI_PROVIDER ?? "stub";
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = require("./anthropic-provider");
    cachedProvider = new AnthropicProvider();
  } else {
    cachedProvider = new StubAIProvider();
  }
  return cachedProvider!;
}

export function isAIConfigured(): boolean {
  return process.env.AI_PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY;
}
