/**
 * Prisma seed — DEV/DEMO data only.
 * Run: npx prisma db seed
 * All passwords: Password@123
 */

import { PrismaClient, Role, Gender, Category, ProfileStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");
  const HASH = await bcrypt.hash("Password@123", 12);

  // ── Departments ─────────────────────────────────────────────────────────────
  const [deptCS, deptAE, deptAvionics] = await Promise.all([
    prisma.department.upsert({
      where: { code: "CSE" },
      update: {},
      create: { name: "Computer Science & Engineering", code: "CSE", description: "Dept of CS & Engineering" },
    }),
    prisma.department.upsert({
      where: { code: "AE" },
      update: {},
      create: { name: "Aerospace Engineering", code: "AE", description: "Dept of Aerospace Engineering" },
    }),
    prisma.department.upsert({
      where: { code: "AVI" },
      update: {},
      create: { name: "Avionics", code: "AVI", description: "Dept of Avionics" },
    }),
  ]);

  // ── Courses ──────────────────────────────────────────────────────────────────
  const [btech, mtech] = await Promise.all([
    prisma.course.upsert({
      where: { code: "BTECH" },
      update: {},
      create: { name: "Bachelor of Technology", code: "BTECH", durationYears: 4 },
    }),
    prisma.course.upsert({
      where: { code: "MTECH" },
      update: {},
      create: { name: "Master of Technology", code: "MTECH", durationYears: 2 },
    }),
  ]);

  // ── Branches ─────────────────────────────────────────────────────────────────
  const [branchCSE, branchAE, branchAVI] = await Promise.all([
    prisma.branch.upsert({
      where: { code: "BTECH-CSE" },
      update: {},
      create: {
        name: "Computer Science & Engineering",
        code: "BTECH-CSE",
        departmentId: deptCS.id,
        courseId: btech.id,
      },
    }),
    prisma.branch.upsert({
      where: { code: "BTECH-AE" },
      update: {},
      create: {
        name: "Aerospace Engineering",
        code: "BTECH-AE",
        departmentId: deptAE.id,
        courseId: btech.id,
      },
    }),
    prisma.branch.upsert({
      where: { code: "BTECH-AVI" },
      update: {},
      create: {
        name: "Avionics",
        code: "BTECH-AVI",
        departmentId: deptAvionics.id,
        courseId: btech.id,
      },
    }),
  ]);

  // ── Batches ──────────────────────────────────────────────────────────────────
  const [batchCSE2425, batchAE2425] = await Promise.all([
    prisma.batch.upsert({
      where: { id: "batch-cse-2021" },
      update: {},
      create: {
        id: "batch-cse-2021",
        name: "B.Tech CSE 2021-25",
        academicYear: "2021-2025",
        branchId: branchCSE.id,
        startYear: 2021,
        endYear: 2025,
      },
    }),
    prisma.batch.upsert({
      where: { id: "batch-ae-2021" },
      update: {},
      create: {
        id: "batch-ae-2021",
        name: "B.Tech AE 2021-25",
        academicYear: "2021-2025",
        branchId: branchAE.id,
        startYear: 2021,
        endYear: 2025,
      },
    }),
  ]);

  // ── TP Admin ─────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "tpadmin@iist.ac.in" },
    update: {},
    create: {
      name: "TP Admin",
      email: "tpadmin@iist.ac.in",
      passwordHash: HASH,
      role: Role.TP_ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log("  ✓ TP Admin:", adminUser.email);

  // ── Faculty ──────────────────────────────────────────────────────────────────
  const facultyUser = await prisma.user.upsert({
    where: { email: "faculty@iist.ac.in" },
    update: {},
    create: {
      name: "Dr. Priya Nair",
      email: "faculty@iist.ac.in",
      passwordHash: HASH,
      role: Role.FACULTY,
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.facultyProfile.upsert({
    where: { userId: facultyUser.id },
    update: {},
    create: {
      userId: facultyUser.id,
      employeeId: "EMP001",
      departmentId: deptCS.id,
      designation: "Assistant Professor",
    },
  });
  console.log("  ✓ Faculty:", facultyUser.email);

  // ── HoD ──────────────────────────────────────────────────────────────────────
  const hodUser = await prisma.user.upsert({
    where: { email: "hod@iist.ac.in" },
    update: {},
    create: {
      name: "Prof. Rajan Krishnan",
      email: "hod@iist.ac.in",
      passwordHash: HASH,
      role: Role.HOD,
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.hodProfile.upsert({
    where: { userId: hodUser.id },
    update: {},
    create: {
      userId: hodUser.id,
      employeeId: "EMP002",
      departmentId: deptCS.id,
    },
  });
  console.log("  ✓ HoD:", hodUser.email);

  // ── Company Rep ───────────────────────────────────────────────────────────────
  const companyUser = await prisma.user.upsert({
    where: { email: "recruiter@isro.gov.in" },
    update: {},
    create: {
      name: "Vikram Sharma",
      email: "recruiter@isro.gov.in",
      passwordHash: HASH,
      role: Role.COMPANY_REP,
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: companyUser.id },
    update: {},
    create: {
      userId: companyUser.id,
      companyName: "ISRO",
      designation: "HR Manager",
    },
  });
  console.log("  ✓ Company Rep:", companyUser.email);

  // ── Student (complete profile) ────────────────────────────────────────────────
  const studentUser = await prisma.user.upsert({
    where: { email: "student@iist.ac.in" },
    update: {},
    create: {
      name: "Arjun Menon",
      email: "student@iist.ac.in",
      passwordHash: HASH,
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentRecord = await prisma.student.upsert({
    where: { enrollmentNumber: "IIST2021CS01" },
    update: {},
    create: {
      userId: studentUser.id,
      enrollmentNumber: "IIST2021CS01",
      branchId: branchCSE.id,
      batchId: batchCSE2425.id,
      profileStatus: ProfileStatus.PENDING_VERIFICATION,
      onboardingStep: 2,
      firstName: "Arjun",
      lastName: "Menon",
      dateOfBirth: new Date("2003-06-15"),
      gender: Gender.MALE,
      category: Category.GENERAL,
      nationality: "Indian",
      phoneNumber: "9876543210",
      currentAddress: "Hostel Block A, IIST Campus",
      currentCity: "Thiruvananthapuram",
      currentState: "Kerala",
      currentPincode: "695547",
      fatherName: "Suresh Menon",
      motherName: "Latha Menon",
      bloodGroup: "O+",
    },
  });

  // Academic record
  const academicRecord = await prisma.academicRecord.upsert({
    where: { studentId: studentRecord.id },
    update: {},
    create: {
      studentId: studentRecord.id,
      tenthSchool: "Kendriya Vidyalaya No.1",
      tenthBoard: "CBSE",
      tenthYear: 2019,
      tenthPercentage: 94.2,
      twelfthSchool: "Kendriya Vidyalaya No.1",
      twelfthBoard: "CBSE",
      twelfthYear: 2021,
      twelfthPercentage: 96.0,
      twelfthStream: "Science",
      currentCgpa: 8.75,
      currentSemester: 7,
      totalBacklogs: 0,
      activeBacklogs: 0,
      jeeAdvancedRank: 412,
    },
  });

  // SGPA records
  const sgpaData = [
    { semester: 1, sgpa: 8.5 },
    { semester: 2, sgpa: 8.8 },
    { semester: 3, sgpa: 8.6 },
    { semester: 4, sgpa: 9.0 },
    { semester: 5, sgpa: 8.9 },
    { semester: 6, sgpa: 8.7 },
  ];

  for (const s of sgpaData) {
    await prisma.sgpaRecord.upsert({
      where: { academicRecordId_semester: { academicRecordId: academicRecord.id, semester: s.semester } },
      update: { sgpa: s.sgpa },
      create: { academicRecordId: academicRecord.id, semester: s.semester, sgpa: s.sgpa, backlogs: 0 },
    });
  }
  console.log("  ✓ Student:", studentUser.email, "(IIST2021CS01, profile complete)");

  // ── Student (incomplete — triggers onboarding redirect) ────────────────────
  const newStudentUser = await prisma.user.upsert({
    where: { email: "newstudent@iist.ac.in" },
    update: {},
    create: {
      name: "New Student",
      email: "newstudent@iist.ac.in",
      passwordHash: HASH,
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.student.upsert({
    where: { enrollmentNumber: "IIST2024AE01" },
    update: {},
    create: {
      userId: newStudentUser.id,
      enrollmentNumber: "IIST2024AE01",
      branchId: branchAE.id,
      batchId: batchAE2425.id,
      profileStatus: ProfileStatus.INCOMPLETE,
      onboardingStep: 0,
    },
  });
  console.log("  ✓ New Student (incomplete):", newStudentUser.email, "(IIST2024AE01)");

  // ── Audit log entries ────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: adminUser.id, action: "CREATE", entity: "Department", entityId: deptCS.id, newValues: { name: "Computer Science & Engineering" } },
      { userId: adminUser.id, action: "CREATE", entity: "Department", entityId: deptAE.id, newValues: { name: "Aerospace Engineering" } },
      { userId: adminUser.id, action: "CREATE", entity: "User", entityId: studentUser.id, newValues: { role: "STUDENT" } },
    ],
    skipDuplicates: true,
  });

  console.log("\n✅ Seed complete!\n");
  console.log("Demo accounts (all passwords: Password@123)");
  console.log("─────────────────────────────────────────────────────");
  console.log("Role         | Login ID                | Password");
  console.log("─────────────────────────────────────────────────────");
  console.log("TP Admin     | tpadmin@iist.ac.in      | Password@123");
  console.log("Faculty      | faculty@iist.ac.in      | Password@123");
  console.log("HoD          | hod@iist.ac.in          | Password@123");
  console.log("Company Rep  | recruiter@isro.gov.in   | Password@123");
  console.log("Student      | IIST2021CS01            | Password@123");
  console.log("New Student  | IIST2024AE01            | Password@123");
  console.log("─────────────────────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
