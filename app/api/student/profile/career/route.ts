import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { getVisibilityMap } from "@/server/services/profile-visibility.service";
import { calculateProfileCompletion } from "@/lib/profile-completion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuth();

    // Determine which student to view
    const { searchParams } = req.nextUrl;
    const targetStudentId = searchParams.get("studentId");

    let studentId: string;

    if (targetStudentId) {
      // Non-student roles can view any profile
      if (actor.role === "STUDENT") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      studentId = targetStudentId;
    } else {
      // Student viewing their own profile
      if (!actor.studentId) {
        return Response.json({ error: "No student profile found" }, { status: 404 });
      }
      studentId = actor.studentId;
    }

    const [student, visibility, completion] = await Promise.all([
      prisma.student.findUniqueOrThrow({
        where: { id: studentId },
        include: {
          user: { select: { email: true, name: true } },
          branch: { include: { department: true, course: true } },
          batch: true,
          academicRecord: { include: { sgpaRecords: { orderBy: { semester: "asc" } } } },
          studentSkills: { include: { skill: true } },
          customSkills: true,
          projects: { orderBy: [{ isOngoing: "desc" }, { startDate: "desc" }] },
          internships: { orderBy: [{ isOngoing: "desc" }, { startDate: "desc" }] },
          certifications: { orderBy: { issueDate: "desc" } },
          achievements: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
          socialProfiles: true,
          videoProfile: true,
        },
      }),
      getVisibilityMap(),
      calculateProfileCompletion(studentId),
    ]);

    // Resolve signed URLs for file assets
    const storage = getStorageAdapter();

    const projects = await Promise.all(
      student.projects.map(async (p) => ({
        ...p,
        imageUrl: p.imageKey ? await storage.getSignedUrl(p.imageKey) : null,
      }))
    );

    const internships = await Promise.all(
      student.internships.map(async (i) => ({
        ...i,
        certificateUrl: i.certificateKey ? await storage.getSignedUrl(i.certificateKey) : null,
      }))
    );

    const certifications = await Promise.all(
      student.certifications.map(async (c) => ({
        ...c,
        certificateUrl: c.certificateKey ? await storage.getSignedUrl(c.certificateKey) : null,
      }))
    );

    const achievements = await Promise.all(
      student.achievements.map(async (a) => ({
        ...a,
        certificateUrl: a.certificateKey ? await storage.getSignedUrl(a.certificateKey) : null,
      }))
    );

    const videoProfile = student.videoProfile
      ? {
          ...student.videoProfile,
          videoFileUrl: student.videoProfile.videoKey
            ? await storage.getSignedUrl(student.videoProfile.videoKey)
            : null,
        }
      : null;

    // Mask private fields based on visibility settings (only apply when viewed by student themselves)
    const isOwnProfile = actor.studentId === studentId;
    const applyVisibility = isOwnProfile ? false : true; // students see all their own fields

    const profile = {
      id: student.id,
      enrollmentNumber: student.enrollmentNumber,
      name: student.user.name,
      email: applyVisibility && !visibility["field:email"] ? undefined : student.user.email,
      branch: student.branch,
      batch: student.batch,
      profileStatus: student.profileStatus,

      // Personal — gated by visibility
      personal: !applyVisibility || visibility["section:personal"]
        ? {
            firstName: student.firstName,
            lastName: student.lastName,
            middleName: student.middleName,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            category: student.category,
            phoneNumber: student.phoneNumber,
            aadharNumber: !applyVisibility || visibility["field:aadharNumber"]
              ? student.aadharNumber : undefined,
            passportNumber: !applyVisibility || visibility["field:passportNumber"]
              ? student.passportNumber : undefined,
            bloodGroup: student.bloodGroup,
            nationality: student.nationality,
          }
        : undefined,

      address: !applyVisibility || visibility["section:address"]
        ? {
            currentAddress: student.currentAddress,
            currentCity: student.currentCity,
            currentState: student.currentState,
            currentPincode: student.currentPincode,
          }
        : undefined,

      family: !applyVisibility || visibility["section:family"]
        ? {
            fatherName: student.fatherName,
            motherName: student.motherName,
            annualFamilyIncome: !applyVisibility || visibility["field:income"]
              ? student.annualFamilyIncome : undefined,
          }
        : undefined,

      academic: !applyVisibility || visibility["section:academic"]
        ? {
            ...student.academicRecord,
            currentCgpa: !applyVisibility || visibility["field:cgpa"]
              ? student.academicRecord?.currentCgpa : undefined,
            activeBacklogs: !applyVisibility || visibility["field:backlogs"]
              ? student.academicRecord?.activeBacklogs : undefined,
          }
        : undefined,

      skills: !applyVisibility || visibility["section:skills"]
        ? { catalogSkills: student.studentSkills, customSkills: student.customSkills }
        : undefined,

      projects: !applyVisibility || visibility["section:projects"] ? projects : undefined,

      internships: !applyVisibility || visibility["section:internships"] ? internships : undefined,

      certifications: !applyVisibility || visibility["section:certifications"]
        ? certifications : undefined,

      achievements: !applyVisibility || visibility["section:achievements"]
        ? achievements : undefined,

      socialProfiles: !applyVisibility || visibility["section:social"]
        ? student.socialProfiles : undefined,

      videoProfile: !applyVisibility || visibility["section:video"] ? videoProfile : undefined,

      completion,
    };

    return Response.json(profile);
  } catch (err) {
    return errorResponse(err);
  }
}
