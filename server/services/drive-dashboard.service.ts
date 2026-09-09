/**
 * Drive Dashboard Service — Phase 3
 *
 * Analytics and metrics for placement drive overview:
 * - Funnel analysis (applications → shortlist → selection)
 * - Branch/gender distribution
 * - Conversion rates
 * - Timeline insights
 */

import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

export type DriveFunnelData = {
  applications: number;
  underReview: number;
  shortlisted: number;
  inProgress: number; // In various rounds
  selected: number;
  rejected: number;
  withdrawn: number;
  conversionRate: number; // selected/applications * 100
  shortlistRate: number;  // shortlisted/applications * 100
};

export type DriveDistribution = {
  byBranch: Record<string, {
    applications: number;
    shortlisted: number;
    selected: number;
    rate: number;
  }>;
  byGender: Record<string, {
    applications: number;
    shortlisted: number;
    selected: number;
    rate: number;
  }>;
  byBatch: Record<string, {
    applications: number;
    shortlisted: number;
    selected: number;
    rate: number;
  }>;
  byCgpaBand: Record<string, {
    applications: number;
    shortlisted: number;
    selected: number;
    avgCgpa: number;
  }>;
};

export type DriveTimeline = {
  dailyApplications: Array<{
    date: string;
    count: number;
    cumulative: number;
  }>;
  roundProgress: Array<{
    roundTitle: string;
    scheduledAt: Date | null;
    participants: number;
    completed: number;
    passRate: number;
  }>;
  milestones: Array<{
    date: Date;
    event: string;
    description: string;
  }>;
};

export type DriveJobRoleAnalysis = {
  byJobRole: Record<string, {
    title: string;
    applications: number;
    shortlisted: number;
    selected: number;
    avgCgpa: number;
    topBranches: Array<{
      branchCode: string;
      count: number;
    }>;
    salaryRange: {
      min: number | null;
      max: number | null;
    };
  }>;
};

export type ComprehensiveDriveAnalytics = {
  driveInfo: {
    id: string;
    title: string;
    status: string;
    company: {
      name: string;
      industry: string;
    };
    timeline: {
      applicationOpenAt: Date | null;
      applicationCloseAt: Date | null;
      driveStartDate: Date | null;
      driveEndDate: Date | null;
    };
  };
  funnel: DriveFunnelData;
  distribution: DriveDistribution;
  timeline: DriveTimeline;
  jobRoles: DriveJobRoleAnalysis;
  insights: {
    topPerformingBranches: string[];
    competitiveRoles: string[];
    applicationTrends: string;
    recommendations: string[];
  };
};

// ─── Main Dashboard Analytics ─────────────────────────────────────────────────

export async function getDriveAnalytics(driveId: string): Promise<ComprehensiveDriveAnalytics> {
  // Validate drive exists
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    include: {
      company: { select: { name: true, industry: true } },
    },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  // Fetch all analytics in parallel
  const [
    funnelData,
    distributionData,
    timelineData,
    jobRoleData,
  ] = await Promise.all([
    getDriveFunnel(driveId),
    getDriveDistribution(driveId),
    getDriveTimeline(driveId),
    getDriveJobRoleAnalysis(driveId),
  ]);

  // Generate insights
  const insights = generateDriveInsights(funnelData, distributionData, jobRoleData);

  return {
    driveInfo: {
      id: drive.id,
      title: drive.title,
      status: drive.status,
      company: drive.company,
      timeline: {
        applicationOpenAt: drive.applicationOpenAt,
        applicationCloseAt: drive.applicationCloseAt,
        driveStartDate: drive.driveStartDate,
        driveEndDate: drive.driveEndDate,
      },
    },
    funnel: funnelData,
    distribution: distributionData,
    timeline: timelineData,
    jobRoles: jobRoleData,
    insights,
  };
}

// ─── Funnel Analysis ──────────────────────────────────────────────────────────

export async function getDriveFunnel(driveId: string): Promise<DriveFunnelData> {
  const statusCounts = await prisma.application.groupBy({
    by: ["status"],
    where: { jobRole: { driveId } },
    _count: { _all: true },
  });

  const counts = statusCounts.reduce(
    (acc, item) => ({ ...acc, [item.status]: item._count._all }),
    {} as Record<string, number>
  );

  const applications = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const underReview = counts.UNDER_REVIEW || 0;
  const shortlisted = counts.SHORTLISTED || 0;
  const selected = counts.SELECTED || 0;
  const rejected = counts.REJECTED || 0;
  const withdrawn = counts.WITHDRAWN || 0;
  
  // Count students in various round stages
  const inProgress = (counts.WRITTEN_TEST || 0) + 
                    (counts.TECHNICAL_ROUND || 0) + 
                    (counts.HR_ROUND || 0) + 
                    (counts.FINAL_ROUND || 0) +
                    (counts.ON_HOLD || 0);

  return {
    applications,
    underReview,
    shortlisted,
    inProgress,
    selected,
    rejected,
    withdrawn,
    conversionRate: applications > 0 ? (selected / applications) * 100 : 0,
    shortlistRate: applications > 0 ? (shortlisted / applications) * 100 : 0,
  };
}

// ─── Distribution Analysis ────────────────────────────────────────────────────

export async function getDriveDistribution(driveId: string): Promise<DriveDistribution> {
  const applications = await prisma.application.findMany({
    where: { jobRole: { driveId } },
    include: {
      student: {
        include: {
          batch: { include: { branch: true } },
          academicRecord: true,
        },
      },
    },
  });

  // By Branch
  const branchMap = new Map<string, { applications: number; shortlisted: number; selected: number }>();
  
  // By Gender
  const genderMap = new Map<string, { applications: number; shortlisted: number; selected: number }>();
  
  // By Batch
  const batchMap = new Map<string, { applications: number; shortlisted: number; selected: number }>();
  
  // By CGPA Band
  const cgpaBandMap = new Map<string, { applications: number; shortlisted: number; selected: number; totalCgpa: number; count: number }>();

  applications.forEach(app => {
    // Branch analysis
    const branchCode = app.student.batch.branch.code;
    if (!branchMap.has(branchCode)) {
      branchMap.set(branchCode, { applications: 0, shortlisted: 0, selected: 0 });
    }
    const branchData = branchMap.get(branchCode)!;
    branchData.applications++;
    if (app.status === "SHORTLISTED") branchData.shortlisted++;
    if (app.status === "SELECTED") branchData.selected++;

    // Gender analysis
    const gender = app.student.gender || "Unknown";
    if (!genderMap.has(gender)) {
      genderMap.set(gender, { applications: 0, shortlisted: 0, selected: 0 });
    }
    const genderData = genderMap.get(gender)!;
    genderData.applications++;
    if (app.status === "SHORTLISTED") genderData.shortlisted++;
    if (app.status === "SELECTED") genderData.selected++;

    // Batch analysis
    const batchYear = app.student.batch.academicYear;
    if (!batchMap.has(batchYear)) {
      batchMap.set(batchYear, { applications: 0, shortlisted: 0, selected: 0 });
    }
    const batchData = batchMap.get(batchYear)!;
    batchData.applications++;
    if (app.status === "SHORTLISTED") batchData.shortlisted++;
    if (app.status === "SELECTED") batchData.selected++;

    // CGPA Band analysis
    const cgpa = app.student.academicRecord?.currentCgpa;
    let cgpaBand = "No Data";
    if (cgpa !== null && cgpa !== undefined) {
      if (cgpa >= 9.0) cgpaBand = "9.0+";
      else if (cgpa >= 8.0) cgpaBand = "8.0-8.9";
      else if (cgpa >= 7.0) cgpaBand = "7.0-7.9";
      else if (cgpa >= 6.0) cgpaBand = "6.0-6.9";
      else cgpaBand = "<6.0";
    }

    if (!cgpaBandMap.has(cgpaBand)) {
      cgpaBandMap.set(cgpaBand, { applications: 0, shortlisted: 0, selected: 0, totalCgpa: 0, count: 0 });
    }
    const cgpaData = cgpaBandMap.get(cgpaBand)!;
    cgpaData.applications++;
    if (app.status === "SHORTLISTED") cgpaData.shortlisted++;
    if (app.status === "SELECTED") cgpaData.selected++;
    if (cgpa !== null && cgpa !== undefined) {
      cgpaData.totalCgpa += cgpa;
      cgpaData.count++;
    }
  });

  return {
    byBranch: Object.fromEntries(
      Array.from(branchMap.entries()).map(([branch, data]) => [
        branch,
        {
          ...data,
          rate: data.applications > 0 ? (data.selected / data.applications) * 100 : 0,
        },
      ])
    ),
    byGender: Object.fromEntries(
      Array.from(genderMap.entries()).map(([gender, data]) => [
        gender,
        {
          ...data,
          rate: data.applications > 0 ? (data.selected / data.applications) * 100 : 0,
        },
      ])
    ),
    byBatch: Object.fromEntries(
      Array.from(batchMap.entries()).map(([batch, data]) => [
        batch,
        {
          ...data,
          rate: data.applications > 0 ? (data.selected / data.applications) * 100 : 0,
        },
      ])
    ),
    byCgpaBand: Object.fromEntries(
      Array.from(cgpaBandMap.entries()).map(([band, data]) => [
        band,
        {
          applications: data.applications,
          shortlisted: data.shortlisted,
          selected: data.selected,
          avgCgpa: data.count > 0 ? data.totalCgpa / data.count : 0,
        },
      ])
    ),
  };
}

// ─── Timeline Analysis ────────────────────────────────────────────────────────

export async function getDriveTimeline(driveId: string): Promise<DriveTimeline> {
  // Daily applications
  const applications = await prisma.application.findMany({
    where: { jobRole: { driveId } },
    select: { appliedAt: true },
    orderBy: { appliedAt: "asc" },
  });

  const dailyMap = new Map<string, number>();
  applications.forEach(app => {
    const date = app.appliedAt.toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  });

  let cumulative = 0;
  const dailyApplications = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      cumulative += count;
      return { date, count, cumulative };
    });

  // Round progress
  const rounds = await prisma.placementRound.findMany({
    where: { driveId },
    include: {
      _count: { select: { participants: true } },
      participants: {
        include: { attendance: true },
        where: { result: { not: null } },
      },
    },
    orderBy: { roundNumber: "asc" },
  });

  const roundProgress = rounds.map(round => {
    const completed = round.participants.length;
    const passCount = round.participants.filter(p => p.result === "PASS").length;
    
    return {
      roundTitle: round.title,
      scheduledAt: round.scheduledAt,
      participants: round._count.participants,
      completed,
      passRate: completed > 0 ? (passCount / completed) * 100 : 0,
    };
  });

  // Milestones
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: {
      applicationOpenAt: true,
      applicationCloseAt: true,
      driveStartDate: true,
      driveEndDate: true,
      createdAt: true,
    },
  });

  const milestones: Array<{ date: Date; event: string; description: string }> = [];
  
  if (drive) {
    milestones.push({
      date: drive.createdAt,
      event: "Drive Created",
      description: "Placement drive was created",
    });
    
    if (drive.applicationOpenAt) {
      milestones.push({
        date: drive.applicationOpenAt,
        event: "Applications Open",
        description: "Students can start applying",
      });
    }
    
    if (drive.applicationCloseAt) {
      milestones.push({
        date: drive.applicationCloseAt,
        event: "Applications Close",
        description: "Application deadline",
      });
    }
    
    if (drive.driveStartDate) {
      milestones.push({
        date: drive.driveStartDate,
        event: "Drive Starts",
        description: "Selection process begins",
      });
    }
    
    if (drive.driveEndDate) {
      milestones.push({
        date: drive.driveEndDate,
        event: "Drive Ends",
        description: "Selection process completes",
      });
    }
  }

  return {
    dailyApplications,
    roundProgress,
    milestones: milestones.sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
}

// ─── Job Role Analysis ────────────────────────────────────────────────────────

export async function getDriveJobRoleAnalysis(driveId: string): Promise<DriveJobRoleAnalysis> {
  const jobRoles = await prisma.jobRole.findMany({
    where: { driveId, isActive: true },
    include: {
      applications: {
        include: {
          student: {
            include: {
              batch: { include: { branch: true } },
              academicRecord: true,
            },
          },
        },
      },
    },
  });

  const byJobRole: Record<string, any> = {};

  jobRoles.forEach(role => {
    const applications = role.applications;
    const shortlisted = applications.filter(app => app.status === "SHORTLISTED").length;
    const selected = applications.filter(app => app.status === "SELECTED").length;

    // Calculate average CGPA
    const cgpaValues = applications
      .map(app => app.student.academicRecord?.currentCgpa)
      .filter(cgpa => cgpa !== null && cgpa !== undefined) as number[];
    const avgCgpa = cgpaValues.length > 0 
      ? cgpaValues.reduce((sum, cgpa) => sum + cgpa, 0) / cgpaValues.length 
      : 0;

    // Top branches
    const branchMap = new Map<string, number>();
    applications.forEach(app => {
      const branchCode = app.student.batch.branch.code;
      branchMap.set(branchCode, (branchMap.get(branchCode) || 0) + 1);
    });

    const topBranches = Array.from(branchMap.entries())
      .map(([branchCode, count]) => ({ branchCode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    byJobRole[role.id] = {
      title: role.title,
      applications: applications.length,
      shortlisted,
      selected,
      avgCgpa,
      topBranches,
      salaryRange: {
        min: role.ctcMin,
        max: role.ctcMax,
      },
    };
  });

  return { byJobRole };
}

// ─── Insights Generation ──────────────────────────────────────────────────────

function generateDriveInsights(
  funnel: DriveFunnelData,
  distribution: DriveDistribution,
  jobRoles: DriveJobRoleAnalysis
): {
  topPerformingBranches: string[];
  competitiveRoles: string[];
  applicationTrends: string;
  recommendations: string[];
} {
  // Top performing branches (by selection rate)
  const topPerformingBranches = Object.entries(distribution.byBranch)
    .sort(([, a], [, b]) => b.rate - a.rate)
    .slice(0, 3)
    .map(([branch]) => branch);

  // Most competitive roles (lowest selection rate)
  const competitiveRoles = Object.entries(jobRoles.byJobRole)
    .map(([id, data]) => ({
      id,
      title: data.title,
      competitionRatio: data.applications / Math.max(data.selected, 1),
    }))
    .sort((a, b) => b.competitionRatio - a.competitionRatio)
    .slice(0, 3)
    .map(role => role.title);

  // Application trends
  let applicationTrends = "Steady application flow";
  if (funnel.applications < 50) {
    applicationTrends = "Low application volume";
  } else if (funnel.applications > 200) {
    applicationTrends = "High application volume";
  }

  // Recommendations
  const recommendations: string[] = [];
  
  if (funnel.shortlistRate < 20) {
    recommendations.push("Consider increasing shortlist rate to ensure adequate candidate pool");
  }
  
  if (funnel.conversionRate < 5) {
    recommendations.push("Review selection criteria - very low conversion rate");
  }
  
  const totalSelected = Object.values(distribution.byBranch)
    .reduce((sum, branch) => sum + branch.selected, 0);
  
  if (totalSelected === 0 && funnel.applications > 10) {
    recommendations.push("No selections yet - review selection process timeline");
  }
  
  const branchDiversity = Object.keys(distribution.byBranch).length;
  if (branchDiversity < 3) {
    recommendations.push("Consider broader outreach to increase branch diversity");
  }

  return {
    topPerformingBranches,
    competitiveRoles,
    applicationTrends,
    recommendations,
  };
}

// ─── Comparative Analytics ────────────────────────────────────────────────────

export async function compareDrivePerformance(driveId: string): Promise<{
  currentDrive: { id: string; title: string; metrics: DriveFunnelData };
  companyAverage: DriveFunnelData;
  industryBenchmark: DriveFunnelData;
  similarDrives: Array<{
    id: string;
    title: string;
    company: string;
    metrics: DriveFunnelData;
    similarity: number;
  }>;
}> {
  const currentDrive = await prisma.placementDrive.findUniqueOrThrow({
    where: { id: driveId },
    include: { company: true },
  });

  const [currentMetrics, companyDrives, industryDrives] = await Promise.all([
    getDriveFunnel(driveId),
    // Company's other drives
    prisma.placementDrive.findMany({
      where: {
        companyId: currentDrive.companyId,
        id: { not: driveId },
        status: { in: ["COMPLETED"] },
      },
    }),
    // Industry benchmark drives
    prisma.placementDrive.findMany({
      where: {
        company: { industry: currentDrive.company.industry },
        status: { in: ["COMPLETED"] },
      },
      include: { company: { select: { name: true } } },
      take: 50,
    }),
  ]);

  // Calculate company average
  const companyFunnels = await Promise.all(
    companyDrives.map(drive => getDriveFunnel(drive.id))
  );
  const companyAverage = calculateAverageFunnel(companyFunnels);

  // Calculate industry benchmark
  const industryFunnels = await Promise.all(
    industryDrives.map(drive => getDriveFunnel(drive.id))
  );
  const industryBenchmark = calculateAverageFunnel(industryFunnels);

  // Find similar drives (same industry, similar application volume)
  const similarDriveTargets = industryDrives
    .filter(drive => drive.id !== driveId)
    .slice(0, 5);

  const similarDrives = await Promise.all(
    similarDriveTargets.map(async (drive) => {
      const metrics = await getDriveFunnel(drive.id);
      const similarity = calculateSimilarity(currentMetrics, metrics);
      
      return {
        id: drive.id,
        title: drive.title,
        company: (drive as any).company?.name || "Unknown",
        metrics,
        similarity,
      };
    })
  );

  return {
    currentDrive: {
      id: currentDrive.id,
      title: currentDrive.title,
      metrics: currentMetrics,
    },
    companyAverage,
    industryBenchmark,
    similarDrives: similarDrives.sort((a, b) => b.similarity - a.similarity),
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function calculateAverageFunnel(funnels: DriveFunnelData[]): DriveFunnelData {
  if (funnels.length === 0) {
    return {
      applications: 0,
      underReview: 0,
      shortlisted: 0,
      inProgress: 0,
      selected: 0,
      rejected: 0,
      withdrawn: 0,
      conversionRate: 0,
      shortlistRate: 0,
    };
  }

  const avg = funnels.reduce(
    (acc, funnel) => ({
      applications: acc.applications + funnel.applications,
      underReview: acc.underReview + funnel.underReview,
      shortlisted: acc.shortlisted + funnel.shortlisted,
      inProgress: acc.inProgress + funnel.inProgress,
      selected: acc.selected + funnel.selected,
      rejected: acc.rejected + funnel.rejected,
      withdrawn: acc.withdrawn + funnel.withdrawn,
      conversionRate: acc.conversionRate + funnel.conversionRate,
      shortlistRate: acc.shortlistRate + funnel.shortlistRate,
    }),
    {
      applications: 0, underReview: 0, shortlisted: 0, inProgress: 0,
      selected: 0, rejected: 0, withdrawn: 0, conversionRate: 0, shortlistRate: 0,
    }
  );

  const count = funnels.length;
  return {
    applications: Math.round(avg.applications / count),
    underReview: Math.round(avg.underReview / count),
    shortlisted: Math.round(avg.shortlisted / count),
    inProgress: Math.round(avg.inProgress / count),
    selected: Math.round(avg.selected / count),
    rejected: Math.round(avg.rejected / count),
    withdrawn: Math.round(avg.withdrawn / count),
    conversionRate: avg.conversionRate / count,
    shortlistRate: avg.shortlistRate / count,
  };
}

function calculateSimilarity(a: DriveFunnelData, b: DriveFunnelData): number {
  // Simple similarity based on conversion and shortlist rates
  const conversionDiff = Math.abs(a.conversionRate - b.conversionRate);
  const shortlistDiff = Math.abs(a.shortlistRate - b.shortlistRate);
  const volumeDiff = Math.abs(a.applications - b.applications) / Math.max(a.applications, b.applications, 1);
  
  // Normalize to 0-100 scale (higher is more similar)
  return Math.max(0, 100 - (conversionDiff + shortlistDiff + volumeDiff * 50));
}