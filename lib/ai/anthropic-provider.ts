import type {
  AIProvider,
  JDAnalysisResult,
  MockInterviewFeedback,
  ResumeImprovementSuggestion,
  ResumeMatchResult,
} from "./index";

export class AnthropicProvider implements AIProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    if (!this.apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  }

  private async callClaude(prompt: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.statusText}`);
    const data = await res.json();
    return data.content[0].text as string;
  }

  async generateResumeMatch(
    resumeText: string,
    jobDescription: string
  ): Promise<ResumeMatchResult> {
    const raw = await this.callClaude(
      `Analyze how well this resume matches the job description. Return JSON only.
Resume: ${resumeText}
Job Description: ${jobDescription}
Return: {"score":0-100,"matchedSkills":[],"missingSkills":[],"suggestions":[]}`
    );
    return JSON.parse(raw);
  }

  async analyzeJD(jobDescription: string): Promise<JDAnalysisResult> {
    const raw = await this.callClaude(
      `Analyze this job description and extract structured data. Return JSON only.
JD: ${jobDescription}
Return: {"requiredSkills":[],"preferredSkills":[],"minCgpa":null,"keywords":[],"summary":""}`
    );
    return JSON.parse(raw);
  }

  async suggestImprovements(
    resumeText: string
  ): Promise<ResumeImprovementSuggestion[]> {
    const raw = await this.callClaude(
      `Suggest improvements for this resume. Return JSON array only.
Resume: ${resumeText}
Return: [{"section":"","suggestion":"","priority":"high|medium|low"}]`
    );
    return JSON.parse(raw);
  }

  async mockInterviewFeedback(
    question: string,
    answer: string
  ): Promise<MockInterviewFeedback> {
    const raw = await this.callClaude(
      `Evaluate this interview answer. Return JSON only.
Question: ${question}
Answer: ${answer}
Return: {"overallScore":0-100,"strengths":[],"areasForImprovement":[],"questionFeedback":[{"question":"","feedback":"","score":0}]}`
    );
    return JSON.parse(raw);
  }
}
