import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { VisibilityUpdateInput } from "@/lib/validations/profile";

// ─── Default visibility settings seeded on first call ────────────────────────

const DEFAULT_SETTINGS = [
  { fieldKey: "section:personal",    label: "Personal Information",    isVisible: true },
  { fieldKey: "field:aadharNumber",  label: "Aadhar Number",           isVisible: false },
  { fieldKey: "field:passportNumber",label: "Passport Number",         isVisible: false },
  { fieldKey: "section:family",      label: "Family Details",          isVisible: false },
  { fieldKey: "section:address",     label: "Address Details",         isVisible: true },
  { fieldKey: "section:academic",    label: "Academic Details",        isVisible: true },
  { fieldKey: "section:skills",      label: "Skills",                  isVisible: true },
  { fieldKey: "section:projects",    label: "Projects",                isVisible: true },
  { fieldKey: "section:internships", label: "Internships / Experience",isVisible: true },
  { fieldKey: "section:certifications", label: "Certifications",       isVisible: true },
  { fieldKey: "section:achievements",label: "Achievements",            isVisible: true },
  { fieldKey: "section:social",      label: "Social Profiles",         isVisible: true },
  { fieldKey: "section:video",       label: "Video Profile",           isVisible: true },
  { fieldKey: "field:cgpa",          label: "CGPA",                    isVisible: true },
  { fieldKey: "field:backlogs",      label: "Backlogs",                isVisible: false },
  { fieldKey: "field:income",        label: "Family Income",           isVisible: false },
] as const;

export type VisibilityKey = typeof DEFAULT_SETTINGS[number]["fieldKey"];

export async function getVisibilitySettings() {
  // Upsert defaults for any missing keys
  for (const def of DEFAULT_SETTINGS) {
    await prisma.profileVisibilitySetting.upsert({
      where: { fieldKey: def.fieldKey },
      create: def,
      update: {}, // don't override admin's changes
    });
  }
  return prisma.profileVisibilitySetting.findMany({ orderBy: { fieldKey: "asc" } });
}

export async function updateVisibilitySettings(data: VisibilityUpdateInput, actorId: string) {
  const results = await Promise.all(
    data.settings.map(({ fieldKey, isVisible }) =>
      prisma.profileVisibilitySetting.upsert({
        where: { fieldKey },
        create: {
          fieldKey,
          isVisible,
          label: DEFAULT_SETTINGS.find((d) => d.fieldKey === fieldKey)?.label ?? fieldKey,
        },
        update: { isVisible },
      })
    )
  );

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "ProfileVisibilitySetting",
    newValues: { changed: data.settings } as any,
  });

  return results;
}

/** Returns a map of fieldKey → boolean for quick lookup in profile render */
export async function getVisibilityMap(): Promise<Record<string, boolean>> {
  const settings = await getVisibilitySettings();
  return Object.fromEntries(settings.map((s) => [s.fieldKey, s.isVisible]));
}
