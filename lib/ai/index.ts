/**
 * AI Service Abstraction
 * All AI calls are stubbed in Phase 1. AI output is ALWAYS staged for
 * student review — never written directly to verified profile data.
 */

export interface ResumeMatchResult {
  score: number;
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

export interface AIProvider {
  generateResumeMatch(
    resumeText: string,
    jobDescription: string
  ): Promise<ResumeMatchResult>;
  analyzeJD(jobDescription: string): Promise<JDAnalysisResult>;
  suggestImprovements(resumeText: string): Promise<ResumeImprovementSuggestion[]>;
  mockInterviewFeedback(
    question: string,
    answer: string
  ): Promise<MockInterviewFeedback>;
}

class StubAIProvider implements AIProvider {
  async generateResumeMatch(): Promise<ResumeMatchResult> {
    throw new Error("AI provider not configured. Set AI_PROVIDER env var.");
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
}

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "stub";
  if (provider === "anthropic") {
    const { AnthropicProvider } = require("./anthropic-provider");
    return new AnthropicProvider();
  }
  return new StubAIProvider();
}
