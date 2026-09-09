/**
 * Report registry — Phase 5
 *
 * One place that knows how to fetch rows for each report type and how to
 * label its columns. `/api/admin/reports/[type]` drives everything off this
 * registry so CSV/XLSX/PDF export share one code path per report, rather
 * than three hand-rolled implementations per report type.
 */

import { prisma } from "@/lib/prisma";
import { getComplianceStatus } from "@/server/services/compliance.service";

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportDefinition {
  key: string;
  label: string;
  columns: ReportColumn[];
  fetch: (params: URLSearchParams) => Promise<Record<string, unknown>[]>;
}

function fullName(p: { firstName: string | null; lastName: string | null } | null | undefined) {
  if (!p) return "";
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

const studentDatabase: ReportDefinition = {
  key: "students",
  label: "Student Database",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "branch", label: "Branch" },
    { key: "batch", label: "Batch" },
    { key: "cgpa", label: "CGPA" },
    { key: "profileStatus", label: "Profile Status" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
  ],
  fetch: async () => {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { email: true } },
        branch: { select: { code: true } },
        batch: { select: { academicYear: true } },
        academicRecord: { select: { currentCgpa: true } },
      },
      orderBy: { enrollmentNumber: "asc" },
    });
    return students.map((s) => ({
      enrollmentNumber: s.enrollmentNumber,
      name: fullName(s),
      branch: s.branch?.code ?? "",
      batch: s.batch?.academicYear ?? "",
      cgpa: s.academicRecord?.currentCgpa ?? "",
      profileStatus: s.profileStatus,
      email: s.user.email,
      phone: s.phoneNumber ?? "",
    }));
  },
};

const driveApplicants: ReportDefinition = {
  key: "applicants",
  label: "Drive Applicants",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "branch", label: "Branch" },
    { key: "cgpa", label: "CGPA" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
    { key: "appliedAt", label: "Applied" },
  ],
  fetch: async (params) => {
    const driveId = params.get("driveId");
    if (!driveId) return [];
    const apps = await prisma.application.findMany({
      where: { driveId },
      include: {
        student: {
          select: {
            enrollmentNumber: true,
            firstName: true,
            lastName: true,
            branch: { select: { code: true } },
            academicRecord: { select: { currentCgpa: true } },
          },
        },
        jobRole: { select: { title: true } },
      },
      orderBy: { appliedAt: "desc" },
    });
    return apps.map((a) => ({
      enrollmentNumber: a.student.enrollmentNumber,
      name: fullName(a.student),
      branch: a.student.branch?.code ?? "",
      cgpa: a.student.academicRecord?.currentCgpa ?? "",
      role: a.jobRole.title,
      status: a.status,
      appliedAt: a.appliedAt.toISOString().slice(0, 10),
    }));
  },
};

const shortlists: ReportDefinition = {
  key: "shortlists",
  label: "Shortlists",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
  ],
  fetch: async (params) => {
    const driveId = params.get("driveId");
    const where = {
      status: { in: ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND", "FINAL_ROUND", "SELECTED"] as any },
      ...(driveId ? { driveId } : {}),
    };
    const apps = await prisma.application.findMany({
      where,
      include: {
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true } },
        jobRole: { select: { title: true } },
      },
      orderBy: { appliedAt: "desc" },
      take: 5000,
    });
    return apps.map((a) => ({
      enrollmentNumber: a.student.enrollmentNumber,
      name: fullName(a.student),
      role: a.jobRole.title,
      status: a.status,
    }));
  },
};

const attendance: ReportDefinition = {
  key: "attendance",
  label: "Attendance",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "round", label: "Round" },
    { key: "status", label: "Status" },
    { key: "markedAt", label: "Marked At" },
  ],
  fetch: async (params) => {
    const roundId = params.get("roundId");
    const records = await prisma.attendanceRecord.findMany({
      where: roundId ? { roundParticipant: { roundId } } : {},
      include: {
        roundParticipant: {
          include: {
            round: { select: { title: true } },
            application: {
              select: { student: { select: { enrollmentNumber: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      take: 5000,
      orderBy: { markedAt: "desc" },
    });
    return records.map((r) => ({
      enrollmentNumber: r.roundParticipant.application.student.enrollmentNumber,
      name: fullName(r.roundParticipant.application.student),
      round: r.roundParticipant.round.title,
      status: r.status,
      markedAt: r.markedAt.toISOString().slice(0, 10),
    }));
  },
};

const skillupResults: ReportDefinition = {
  key: "skillup",
  label: "SkillUp Results",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "test", label: "Test" },
    { key: "category", label: "Category" },
    { key: "marks", label: "Marks" },
    { key: "percentage", label: "Percentage" },
    { key: "result", label: "Result" },
  ],
  fetch: async (params) => {
    const testId = params.get("testId");
    const results = await prisma.testResult.findMany({
      where: testId ? { testId } : {},
      include: {
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true } },
        test: { select: { title: true, testType: { select: { name: true } } } },
      },
      take: 5000,
      orderBy: { percentage: "desc" },
    });
    return results.map((r) => ({
      enrollmentNumber: r.student.enrollmentNumber,
      name: fullName(r.student),
      test: r.test.title,
      category: r.test.testType.name,
      marks: `${r.marksObtained}/${r.maxMarks}`,
      percentage: r.percentage.toFixed(1),
      result: r.isPassed ? "Pass" : "Fail",
    }));
  },
};

const interviewResults: ReportDefinition = {
  key: "interviews",
  label: "Mock Interview Results",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "interviewer", label: "Interviewer" },
    { key: "type", label: "Type" },
    { key: "overallScore", label: "Overall Score" },
    { key: "date", label: "Date" },
  ],
  fetch: async () => {
    const interviews = await prisma.mockInterview.findMany({
      where: { result: { isNot: null } },
      include: {
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true } },
        result: { select: { overallScore: true } },
      },
      take: 5000,
      orderBy: { scheduledAt: "desc" },
    });
    return interviews.map((i) => ({
      enrollmentNumber: i.student.enrollmentNumber,
      name: fullName(i.student),
      interviewer: i.interviewerName,
      type: i.type,
      overallScore: i.result?.overallScore ?? "",
      date: i.scheduledAt.toISOString().slice(0, 10),
    }));
  },
};

const placementStats: ReportDefinition = {
  key: "placement-stats",
  label: "Placement Stats",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "branch", label: "Branch" },
    { key: "company", label: "Company" },
    { key: "role", label: "Role" },
    { key: "ctc", label: "CTC (LPA)" },
    { key: "status", label: "Offer Status" },
  ],
  fetch: async () => {
    const offers = await prisma.offer.findMany({
      include: {
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true, branch: { select: { code: true } } } },
        company: { select: { name: true } },
        jobRole: { select: { title: true } },
      },
      orderBy: { offerDate: "desc" },
      take: 5000,
    });
    return offers.map((o) => ({
      enrollmentNumber: o.student.enrollmentNumber,
      name: fullName(o.student),
      branch: o.student.branch?.code ?? "",
      company: o.company.name,
      role: o.jobRole.title,
      ctc: o.ctc ?? "",
      status: o.status,
    }));
  },
};

const offersReport: ReportDefinition = {
  key: "offers",
  label: "Offers",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "company", label: "Company" },
    { key: "type", label: "Type" },
    { key: "category", label: "Category" },
    { key: "ctc", label: "CTC (LPA)" },
    { key: "offerDate", label: "Offer Date" },
    { key: "status", label: "Status" },
  ],
  fetch: async () => {
    const offers = await prisma.offer.findMany({
      include: {
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
      orderBy: { offerDate: "desc" },
      take: 5000,
    });
    return offers.map((o) => ({
      enrollmentNumber: o.student.enrollmentNumber,
      name: fullName(o.student),
      company: o.company.name,
      type: o.type,
      category: o.category,
      ctc: o.ctc ?? "",
      offerDate: o.offerDate.toISOString().slice(0, 10),
      status: o.status,
    }));
  },
};

const departmentWise: ReportDefinition = {
  key: "department-wise",
  label: "Department-wise Placement",
  columns: [
    { key: "department", label: "Department" },
    { key: "totalStudents", label: "Total Students" },
    { key: "placed", label: "Placed" },
    { key: "placementRate", label: "Placement Rate (%)" },
  ],
  fetch: async () => {
    const { getDepartmentBreakdown } = await import("@/server/services/analytics.service");
    const rows = await getDepartmentBreakdown();
    return rows.map((r) => ({
      department: r.departmentName,
      totalStudents: r.totalStudents,
      placed: r.placed,
      placementRate: r.placementRate,
    }));
  },
};

const companyWise: ReportDefinition = {
  key: "company-wise",
  label: "Company-wise Placement",
  columns: [
    { key: "company", label: "Company" },
    { key: "drives", label: "Drives" },
    { key: "offers", label: "Offers" },
    { key: "avgCtc", label: "Avg CTC (LPA)" },
  ],
  fetch: async () => {
    const { listCompanySummaries } = await import("@/server/services/analytics.service");
    const rows = await listCompanySummaries();
    return rows.map((r) => ({
      company: r.name,
      drives: r.driveCount,
      offers: r.offerCount,
      avgCtc: r.avgCtc ?? "",
    }));
  },
};

const complianceReport: ReportDefinition = {
  key: "compliance",
  label: "Compliance Report",
  columns: [
    { key: "enrollmentNumber", label: "Enrollment No." },
    { key: "name", label: "Name" },
    { key: "status", label: "Compliance Status" },
    { key: "isOverridden", label: "Overridden" },
    { key: "openIncidents", label: "Open Incidents" },
    { key: "reasons", label: "Reasons" },
  ],
  fetch: async () => {
    const students = await prisma.student.findMany({
      select: { id: true, enrollmentNumber: true, firstName: true, lastName: true },
      take: 2000,
    });
    const rows = [];
    for (const s of students) {
      const c = await getComplianceStatus(s.id);
      rows.push({
        enrollmentNumber: s.enrollmentNumber,
        name: fullName(s),
        status: c.status,
        isOverridden: c.isOverridden ? "Yes" : "No",
        openIncidents: c.signals.openIncidents.length,
        reasons: c.reasons.join("; "),
      });
    }
    return rows;
  },
};

export const REPORTS: Record<string, ReportDefinition> = {
  [studentDatabase.key]: studentDatabase,
  [driveApplicants.key]: driveApplicants,
  [shortlists.key]: shortlists,
  [attendance.key]: attendance,
  [skillupResults.key]: skillupResults,
  [interviewResults.key]: interviewResults,
  [placementStats.key]: placementStats,
  [offersReport.key]: offersReport,
  [departmentWise.key]: departmentWise,
  [companyWise.key]: companyWise,
  [complianceReport.key]: complianceReport,
};

export const REPORT_LIST = Object.values(REPORTS).map((r) => ({ key: r.key, label: r.label }));
