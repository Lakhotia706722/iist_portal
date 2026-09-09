import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  JDAnalysisResult,
  MockInterviewFeedback,
  ResumeImprovementSuggestion,
  ResumeMatchResult,
  DraftBullet,
  CareerRecommendation,
} from "./index";

/** Current-generation model. Reasoning-heavy tasks (resume grounding,
 * career advice) benefit from Sonnet 5 over a lighter model. */
const MODEL = "claude-sonnet-5";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.client = new Anthropic({ apiKey });
  }

  /** Ask Claude for strict JSON and parse it, tolerating a stray code fence. */
  private async callJSON<T>(system: string, prompt: string, maxTokens = 1500): Promise<T> {
    const res = await this.client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && "text" in block ? block.text : "";
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new Error("AI returned a response that could not be parsed as JSON.");
    }
  }

  async generateResumeMatch(
    resumeText: string,
    jobDescription: string
  ): Promise<ResumeMatchResult> {
    return this.callJSON<ResumeMatchResult>(
      "You are a placement-cell resume screening assistant. Score honestly and conservatively — do not inflate scores. Return ONLY valid JSON, no prose, no markdown fences.",
      `Score how well this candidate's verified profile (used as their resume text) matches the job description.

Resume/profile text:
"""
${resumeText}
"""

Job description:
"""
${jobDescription}
"""

Return exactly this JSON shape:
{
  "score": <0-100 integer>,
  "breakdown": {
    "skills": {"score": <0-100>, "matched": [string], "missing": [string]},
    "projects": {"score": <0-100>, "note": "<one sentence>"},
    "experience": {"score": <0-100>, "note": "<one sentence>"},
    "education": {"score": <0-100>, "note": "<one sentence>"},
    "keywords": {"score": <0-100>, "matched": [string], "missing": [string]}
  },
  "matchedSkills": [string],
  "missingSkills": [string],
  "suggestions": [string]
}`
    );
  }

  async analyzeJD(jobDescription: string): Promise<JDAnalysisResult> {
    return this.callJSON<JDAnalysisResult>(
      "You extract structured hiring requirements from job descriptions. Return ONLY valid JSON.",
      `Analyze this job description and extract structured data.

JD:
"""
${jobDescription}
"""

Return exactly this JSON shape:
{"requiredSkills":[string],"preferredSkills":[string],"minCgpa":<number or null>,"keywords":[string],"summary":"<2-3 sentences>"}`
    );
  }

  async suggestImprovements(resumeText: string): Promise<ResumeImprovementSuggestion[]> {
    return this.callJSON<ResumeImprovementSuggestion[]>(
      "You give concise, actionable resume feedback. You never invent facts, companies, or skills not present in the text given. Return ONLY a valid JSON array.",
      `Suggest improvements for this resume text — phrasing, structure, quantification, clarity. Do not suggest adding any skill, project, or experience not already present in the text.

Resume:
"""
${resumeText}
"""

Return exactly this JSON shape: [{"section":"<section name>","suggestion":"<specific, actionable>","priority":"high|medium|low"}]`
    );
  }

  async mockInterviewFeedback(
    question: string,
    answer: string
  ): Promise<MockInterviewFeedback> {
    return this.callJSON<MockInterviewFeedback>(
      "You are an experienced technical interviewer giving constructive practice feedback. Return ONLY valid JSON.",
      `Evaluate this practice interview answer.

Question: ${question}
Answer: ${answer}

Return exactly this JSON shape:
{"overallScore":<0-100>,"strengths":[string],"areasForImprovement":[string],"questionFeedback":[{"question":"${question.replace(/"/g, '\\"')}","feedback":"<2-3 sentences>","score":<0-100>}]}`
    );
  }

  async draftResumeBullets(
    verifiedFacts: string[],
    targetRole: string,
    jobDescription: string
  ): Promise<DraftBullet[]> {
    const numbered = verifiedFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    return this.callJSON<DraftBullet[]>(
      `You draft resume bullets STRICTLY from a numbered list of verified facts about a candidate. You must never introduce a skill, project, company, metric, or achievement that is not present in the numbered facts. Every bullet's "sourceFact" field must be copied verbatim (or near-verbatim) from exactly one numbered fact. If the facts don't support a strong bullet for some part of the resume, write fewer bullets rather than inventing content. Return ONLY a valid JSON array.`,
      `Candidate's verified facts (the ONLY information you may use):
${numbered}

Target role: ${targetRole}

Job description:
"""
${jobDescription}
"""

Draft 6-10 resume bullets tailored to this role, distributed across sections (summary, skills, projects, experience, certifications, achievements as applicable), each grounded in exactly one of the numbered facts above.

Return exactly this JSON shape: [{"section":"summary|skills|projects|experience|certifications|achievements","text":"<bullet text>","sourceFact":"<the exact numbered fact text this is based on, without the number>"}]`,
      2000
    );
  }

  async careerRecommendations(
    verifiedFacts: string[],
    interests?: string
  ): Promise<CareerRecommendation[]> {
    const numbered = verifiedFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    return this.callJSON<CareerRecommendation[]>(
      "You are a career counsellor for engineering students. Give grounded, realistic career-path suggestions based on the student's actual background. Return ONLY a valid JSON array.",
      `Candidate's verified background:
${numbered}
${interests ? `\nStated interests: ${interests}` : ""}

Suggest 3-5 realistic career paths or specializations this student could pursue, given their actual background above.

Return exactly this JSON shape: [{"title":"<career path>","rationale":"<2-3 sentences tied to their background>","suggestedSkills":[string]}]`
    );
  }
}
