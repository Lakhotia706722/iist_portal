import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { PersonalInfoInput, AcademicInfoInput } from "@/lib/validations/student";

export async function savePersonalInfo(studentId: string, data: PersonalInfoInput, actorId: string) {
  const old = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });

  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      category: data.category,
      religion: data.religion || null,
      nationality: data.nationality,
      motherTongue: data.motherTongue || null,
      aadharNumber: data.aadharNumber || null,
      personalEmail: data.personalEmail || null,
      phoneNumber: data.phoneNumber,
      alternatePhone: data.alternatePhone || null,
      currentAddress: data.currentAddress,
      currentCity: data.currentCity,
      currentState: data.currentState,
      currentPincode: data.currentPincode,
      permanentAddress: data.permanentAddress || null,
      permanentCity: data.permanentCity || null,
      permanentState: data.permanentState || null,
      permanentPincode: data.permanentPincode || null,
      fatherName: data.fatherName,
      fatherOccupation: data.fatherOccupation || null,
      fatherPhone: data.fatherPhone || null,
      motherName: data.motherName,
      motherOccupation: data.motherOccupation || null,
      motherPhone: data.motherPhone || null,
      annualFamilyIncome: data.annualFamilyIncome ?? null,
      bloodGroup: data.bloodGroup || null,
      passportNumber: data.passportNumber || null,
      onboardingStep: Math.max(old.onboardingStep, 1),
      profileStatus: old.onboardingStep >= 1 ? old.profileStatus : "INCOMPLETE",
    },
  });

  // Also update the User name
  await prisma.user.update({
    where: { id: actorId },
    data: { name: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ") },
  });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "Student",
    entityId: studentId,
    newValues: { section: "personal_info" },
  });

  return student;
}

export async function saveAcademicInfo(studentId: string, data: AcademicInfoInput, actorId: string) {
  const { sgpaRecords, ...academicData } = data;

  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });

  // Upsert the academic record
  const record = await prisma.academicRecord.upsert({
    where: { studentId },
    create: {
      studentId,
      tenthSchool: academicData.tenthSchool,
      tenthBoard: academicData.tenthBoard,
      tenthYear: academicData.tenthYear,
      tenthPercentage: academicData.tenthPercentage,
      twelfthSchool: academicData.twelfthSchool,
      twelfthBoard: academicData.twelfthBoard,
      twelfthYear: academicData.twelfthYear,
      twelfthPercentage: academicData.twelfthPercentage,
      twelfthStream: academicData.twelfthStream || null,
      diplomaInstitute: academicData.diplomaInstitute || null,
      diplomaBranch: academicData.diplomaBranch || null,
      diplomaYear: academicData.diplomaYear ?? null,
      diplomaPercentage: academicData.diplomaPercentage ?? null,
      currentCgpa: academicData.currentCgpa,
      currentSemester: academicData.currentSemester,
      totalBacklogs: academicData.totalBacklogs ?? 0,
      activeBacklogs: academicData.activeBacklogs ?? 0,
      jeeMainRank: academicData.jeeMainRank ?? null,
      jeeAdvancedRank: academicData.jeeAdvancedRank ?? null,
    },
    update: {
      tenthSchool: academicData.tenthSchool,
      tenthBoard: academicData.tenthBoard,
      tenthYear: academicData.tenthYear,
      tenthPercentage: academicData.tenthPercentage,
      twelfthSchool: academicData.twelfthSchool,
      twelfthBoard: academicData.twelfthBoard,
      twelfthYear: academicData.twelfthYear,
      twelfthPercentage: academicData.twelfthPercentage,
      twelfthStream: academicData.twelfthStream || null,
      currentCgpa: academicData.currentCgpa,
      currentSemester: academicData.currentSemester,
      totalBacklogs: academicData.totalBacklogs ?? 0,
      activeBacklogs: academicData.activeBacklogs ?? 0,
      jeeMainRank: academicData.jeeMainRank ?? null,
      jeeAdvancedRank: academicData.jeeAdvancedRank ?? null,
    },
  });

  // Replace all SGPA records
  await prisma.sgpaRecord.deleteMany({ where: { academicRecordId: record.id } });
  if (sgpaRecords.length > 0) {
    await prisma.sgpaRecord.createMany({
      data: sgpaRecords.map((r) => ({
        academicRecordId: record.id,
        semester: r.semester,
        sgpa: r.sgpa,
        backlogs: r.backlogs ?? 0,
      })),
    });
  }

  // Mark onboarding complete
  await prisma.student.update({
    where: { id: studentId },
    data: {
      onboardingStep: 2,
      profileStatus: "PENDING_VERIFICATION",
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "Student",
    entityId: studentId,
    newValues: { section: "academic_info", onboardingStep: 2 },
  });

  return record;
}

export async function getStudentProfile(studentId: string) {
  return prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      branch: { include: { department: true, course: true } },
      batch: true,
      academicRecord: { include: { sgpaRecords: { orderBy: { semester: "asc" } } } },
      user: { select: { name: true, email: true, lastLoginAt: true } },
    },
  });
}
