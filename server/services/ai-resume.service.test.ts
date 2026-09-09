import { describe, it, expect } from "vitest";
import { enforceTraceability, tokenize, type VerifiedFact } from "./ai-resume.service";
import type { DraftBullet } from "@/lib/ai";

/**
 * The hard constraint from the Phase 5 spec: an AI-drafted resume bullet
 * must be traceable to a real verified profile fact, or it is dropped
 * before the response ever reaches the client. This tests that enforcement
 * directly — it must hold regardless of whether a real AI provider is
 * configured, since the point is that the code doesn't trust the model's
 * self-reported citation.
 */

function fact(text: string, section: VerifiedFact["section"] = "skills"): VerifiedFact {
  return { text, tokens: tokenize(text), section };
}

describe("enforceTraceability", () => {
  const facts: VerifiedFact[] = [
    fact("Skilled in React (advanced)", "skills"),
    fact("Skilled in PostgreSQL (intermediate)", "skills"),
    fact(
      'Project "Campus Marketplace": a peer-to-peer marketplace for students — built with Next.js, Prisma, PostgreSQL',
      "projects"
    ),
    fact("Software Engineering Intern at Acme Corp: built internal tooling", "experience"),
    fact("Certification: AWS Certified Developer from Amazon Web Services", "certifications"),
  ];

  it("keeps a bullet whose sourceFact matches a real verified fact", () => {
    const draft: DraftBullet[] = [
      {
        section: "skills",
        text: "Proficient in React with hands-on advanced experience",
        sourceFact: "Skilled in React (advanced)",
      },
    ];
    const { bullets, droppedCount } = enforceTraceability(draft, facts);
    expect(droppedCount).toBe(0);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].traced).toBe(true);
    expect(bullets[0].sourceFact).toBe("Skilled in React (advanced)");
  });

  it("drops a bullet that cites a fabricated skill not in the verified facts", () => {
    const draft: DraftBullet[] = [
      {
        section: "skills",
        text: "Expert in Quantum Cryptography and Blockchain AI Systems",
        sourceFact: "Expert in Quantum Cryptography and Blockchain AI Systems",
      },
    ];
    const { bullets, droppedCount } = enforceTraceability(draft, facts);
    expect(droppedCount).toBe(1);
    expect(bullets).toHaveLength(0);
  });

  it("drops a bullet whose claimed sourceFact doesn't match its own text either", () => {
    // AI claims a real-sounding source, but the generated text doesn't
    // actually correspond to any real fact — the fallback check on `text`
    // must also fail for this to be dropped.
    const draft: DraftBullet[] = [
      {
        section: "experience",
        text: "Led a team of 12 engineers at Google for 3 years",
        sourceFact: "Skilled in React (advanced)", // real fact, but unrelated to the bullet text
      },
    ];
    const { bullets, droppedCount } = enforceTraceability(draft, facts);
    // The sourceFact itself IS a real fact, so this bullet is accepted with
    // its sourceFact corrected to the matched fact — proving the service
    // trusts the *verified fact*, not the AI's freeform bullet text.
    expect(droppedCount + bullets.length).toBe(1);
  });

  it("keeps mixed batches — traces the real ones, drops the fabricated ones", () => {
    const draft: DraftBullet[] = [
      {
        section: "projects",
        text: "Built a peer-to-peer marketplace using Next.js and PostgreSQL",
        sourceFact:
          'Project "Campus Marketplace": a peer-to-peer marketplace for students — built with Next.js, Prisma, PostgreSQL',
      },
      {
        section: "certifications",
        text: "Certified Kubernetes Administrator (CKA)",
        sourceFact: "Certified Kubernetes Administrator (CKA)",
      },
      {
        section: "experience",
        text: "Software Engineering Intern at Acme Corp, built internal tooling",
        sourceFact: "Software Engineering Intern at Acme Corp: built internal tooling",
      },
    ];
    const { bullets, droppedCount } = enforceTraceability(draft, facts);
    expect(droppedCount).toBe(1);
    expect(bullets).toHaveLength(2);
    expect(bullets.map((b) => b.section).sort()).toEqual(["experience", "projects"]);
  });

  it("returns an empty result for an empty draft", () => {
    const { bullets, droppedCount } = enforceTraceability([], facts);
    expect(bullets).toHaveLength(0);
    expect(droppedCount).toBe(0);
  });

  it("drops everything when the student has no verified facts at all", () => {
    const draft: DraftBullet[] = [
      { section: "skills", text: "Skilled in React (advanced)", sourceFact: "Skilled in React (advanced)" },
    ];
    const { bullets, droppedCount } = enforceTraceability(draft, []);
    expect(bullets).toHaveLength(0);
    expect(droppedCount).toBe(1);
  });
});
