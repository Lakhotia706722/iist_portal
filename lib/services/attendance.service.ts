/**
 * Attendance Service — Phase 3
 *
 * Round attendance tracking with bulk marking,
 * analytics, and automated reporting.
 */

import { prisma } from "@/lib/prisma";
import { AttendanceInput, BulkAttendanceInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";

export type AttendanceRecord = {
  id: string;
  roundParticipantId: string;
  status: string;
  note: string | null;
  markedAt: Date;
  markedById: string | null;
  roundParticipant: {
    id: string;
    application: {
      id: string;
      student: {
        enrollmentNumber: string;
        firstName: string;
        lastName: string;
        email: string;
        batch: {
          academicYear: string;
          branch: {
            code: string;
            name: string;
          };
        };
      };
      jobRole: {
        title: string;
      };
    };
  };
};

export type AttendanceSummary = {
  roundId: string;
  roundTitle: string;
  scheduledAt: Date | null;
  totalParticipants: number;
  attendanceMarked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
};

// ─── Mark Individual Attendance ───────────────────────────────────────────────

export async function markAttendance(
  roundParticipantId: string,
  data: AttendanceInput,
  markedBy: string
): Promise<AttendanceRecord> {
  // Validate participant exists
  const participant = await prisma.roundParticipant.findUnique({
    where: { id: roundParticipantId },
    include: { round: true },
  });

  if (!participant) {
    throw new NotFoundError("Round participant not found");
  }

  // Check if attendance already exists
  const existingAttendance = await prisma.attendanceRecord.findUnique({
    where: { roundParticipantId },
  });

  let attendanceRecord;

  if (existingAttendance) {
    // Update existing record
    attendanceRecord = await prisma.attendanceRecord.update({
      where: { id: existingAttendance.id },
      data: {
        status: data.status,
        note: data.note,
        markedById: markedBy,
        markedAt: new Date(),
      },
      include: {
        roundParticipant: {
          include: {
            application: {
              include: {
                student: {
                  include: {
                    batch: { include: { branch: true } },
                  },
                },
                jobRole: true,
              },
            },
          },
        },
      },
    });
  } else {
    // Create new record
    attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        roundParticipantId,
        status: data.status,
        note: data.note,
        markedById: markedBy,
        markedAt: new Date(),
      },
      include: {
        roundParticipant: {
          include: {
            application: {
              include: {
                student: {
                  include: {
                    batch: { include: { branch: true } },
                  },
                },
                jobRole: true,
              },
            },
          },
        },
      },
    });
  }

  return attendanceRecord as unknown as AttendanceRecord;
}

// ─── Bulk Attendance Marking ─────────────────────────────────────────────────

export async function bulkMarkAttendance(
  data: BulkAttendanceInput,
  markedBy: string
): Promise<{
  updated: number;
  failed: Array<{ roundParticipantId: string; reason: string }>;
}> {
  // Validate all participants exist
  const participantIds = data.records.map(r => r.roundParticipantId);
  const participants = await prisma.roundParticipant.findMany({
    where: { id: { in: participantIds } },
    select: { id: true },
  });

  const validIds = participants.map(p => p.id);
  const invalidRecords = data.records.filter(r => !validIds.includes(r.roundParticipantId));

  if (validIds.length === 0) {
    throw new ValidationError("No valid participants found");
  }

  let updated = 0;
  const failed: Array<{ roundParticipantId: string; reason: string }> = [];

  // Process each valid record
  await prisma.$transaction(async (tx) => {
    for (const record of data.records) {
      if (!validIds.includes(record.roundParticipantId)) {
        failed.push({
          roundParticipantId: record.roundParticipantId,
          reason: "Participant not found",
        });
        continue;
      }

      try {
        // Check if attendance already exists
        const existing = await tx.attendanceRecord.findUnique({
          where: { roundParticipantId: record.roundParticipantId },
        });

        if (existing) {
          // Update existing
          await tx.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              note: record.note,
              markedById: markedBy,
              markedAt: new Date(),
            },
          });
        } else {
          // Create new
          await tx.attendanceRecord.create({
            data: {
              roundParticipantId: record.roundParticipantId,
              status: record.status,
              note: record.note,
              markedById: markedBy,
              markedAt: new Date(),
            },
          });
        }

        updated++;
      } catch (error) {
        failed.push({
          roundParticipantId: record.roundParticipantId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  return { updated, failed };
}

// ─── Get Round Attendance ─────────────────────────────────────────────────────

export async function getRoundAttendance(
  roundId: string
): Promise<{
  round: {
    id: string;
    title: string;
    scheduledAt: Date | null;
    venue: string | null;
  };
  participants: Array<{
    id: string;
    student: {
      enrollmentNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      batch: {
        academicYear: string;
        branch: { code: string; name: string };
      };
    };
    jobRole: { title: string };
    attendance: {
      id: string;
      status: string;
      note: string | null;
      markedAt: Date;
      markedById: string | null;
    } | null;
  }>;
  summary: AttendanceSummary;
}> {
  // Get round details
  const round = await prisma.placementRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      venue: true,
    },
  });

  if (!round) {
    throw new NotFoundError("Round not found");
  }

  // Get participants with attendance
  const participants = await prisma.roundParticipant.findMany({
    where: { roundId },
    include: {
      application: {
        include: {
          student: {
            include: {
              batch: { include: { branch: true } },
            },
          },
          jobRole: { select: { title: true } },
        },
      },
      attendance: true,
    },
    orderBy: [
      { application: { student: { enrollmentNumber: "asc" } } },
    ],
  });

  // Calculate summary
  const totalParticipants = participants.length;
  const attendanceMarked = participants.filter(p => p.attendance).length;
  const statusCounts = participants.reduce(
    (acc, p) => {
      if (p.attendance) {
        acc[p.attendance.status] = (acc[p.attendance.status] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const summary: AttendanceSummary = {
    roundId,
    roundTitle: round.title,
    scheduledAt: round.scheduledAt,
    totalParticipants,
    attendanceMarked,
    present: statusCounts.PRESENT || 0,
    absent: statusCounts.ABSENT || 0,
    late: statusCounts.LATE || 0,
    excused: statusCounts.EXCUSED || 0,
    attendanceRate: totalParticipants > 0 ? (attendanceMarked / totalParticipants) * 100 : 0,
  };

  return {
    round,
    participants: participants.map(p => ({
      id: p.id,
      student: {
        enrollmentNumber: p.application.student.enrollmentNumber,
        firstName: p.application.student.firstName ?? "",
        lastName: p.application.student.lastName ?? "",
        email: (p.application.student as any).email ?? "",
        batch: {
          academicYear: p.application.student.batch.academicYear,
          branch: {
            code: p.application.student.batch.branch.code,
            name: p.application.student.batch.branch.name,
          },
        },
      },
      jobRole: { title: p.application.jobRole.title },
      attendance: p.attendance ? {
        id: p.attendance.id,
        status: p.attendance.status,
        note: p.attendance.note,
        markedAt: p.attendance.markedAt,
        markedById: p.attendance.markedById,
      } : null,
    })),
    summary,
  };
}

// ─── Get Student Attendance History ───────────────────────────────────────────

export async function getStudentAttendanceHistory(
  studentId: string,
  filters?: {
    academicYear?: string;
    driveId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  records: Array<{
    id: string;
    status: string;
    note: string | null;
    markedAt: Date;
    round: {
      title: string;
      scheduledAt: Date | null;
      drive: {
        title: string;
        company: { name: string };
      };
    };
  }>;
  total: number;
  summary: {
    totalRounds: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
}> {
  const where: any = {
    roundParticipant: {
      application: { studentId },
    },
  };

  if (filters?.driveId) {
    where.roundParticipant.round = { driveId: filters.driveId };
  }

  if (filters?.academicYear) {
    where.roundParticipant.round = {
      ...where.roundParticipant.round,
      drive: { academicYear: filters.academicYear },
    };
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        roundParticipant: {
          include: {
            round: {
              include: {
                drive: {
                  include: { company: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { markedAt: "desc" },
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  // Calculate summary
  const statusCounts = records.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const summary = {
    totalRounds: total,
    present: statusCounts.PRESENT || 0,
    absent: statusCounts.ABSENT || 0,
    late: statusCounts.LATE || 0,
    excused: statusCounts.EXCUSED || 0,
    attendanceRate: total > 0 ? ((statusCounts.PRESENT || 0) + (statusCounts.LATE || 0)) / total * 100 : 0,
  };

  return {
    records: records.map(record => ({
      id: record.id,
      status: record.status,
      note: record.note,
      markedAt: record.markedAt,
      round: {
        title: record.roundParticipant.round.title,
        scheduledAt: record.roundParticipant.round.scheduledAt,
        drive: {
          title: record.roundParticipant.round.drive.title,
          company: record.roundParticipant.round.drive.company,
        },
      },
    })),
    total,
    summary,
  };
}

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export async function getAttendanceAnalytics(driveId?: string): Promise<{
  overallStats: {
    totalRounds: number;
    totalParticipants: number;
    averageAttendanceRate: number;
    trendsOverTime: Array<{
      date: string;
      attendanceRate: number;
      roundCount: number;
    }>;
  };
  byRoundType: Record<string, {
    rounds: number;
    averageAttendance: number;
  }>;
  byBranch: Record<string, {
    totalStudents: number;
    averageAttendance: number;
  }>;
  defaulters: Array<{
    studentId: string;
    enrollmentNumber: string;
    name: string;
    absentCount: number;
    totalRounds: number;
    attendanceRate: number;
  }>;
}> {
  const driveFilter = driveId ? { driveId } : {};

  const [roundStats, attendanceData, branchData] = await Promise.all([
    // Overall round statistics
    prisma.placementRound.findMany({
      where: driveFilter,
      include: {
        _count: { select: { participants: true } },
        participants: {
          include: { attendance: true },
        },
      },
    }),
    // Attendance records with round details
    prisma.attendanceRecord.findMany({
      where: {
        roundParticipant: { round: driveFilter },
      },
      include: {
        roundParticipant: {
          include: {
            round: { select: { scheduledAt: true, type: true } },
            application: {
              include: {
                student: {
                  include: {
                    batch: { include: { branch: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Branch-wise participation data
    prisma.roundParticipant.findMany({
      where: { round: driveFilter },
      include: {
        application: {
          include: {
            student: {
              include: {
                batch: { include: { branch: true } },
              },
            },
          },
        },
        attendance: true,
      },
    }),
  ]);

  // Process overall stats
  const totalRounds = roundStats.length;
  const totalParticipants = roundStats.reduce((sum, round) => sum + round._count.participants, 0);
  
  const roundAttendanceRates = roundStats.map(round => {
    const attendedCount = round.participants.filter(p => 
      p.attendance && ["PRESENT", "LATE"].includes(p.attendance.status)
    ).length;
    return round._count.participants > 0 ? (attendedCount / round._count.participants) * 100 : 0;
  });

  const averageAttendanceRate = roundAttendanceRates.length > 0 
    ? roundAttendanceRates.reduce((sum, rate) => sum + rate, 0) / roundAttendanceRates.length 
    : 0;

  // Trends over time (last 30 days)
  const trendsMap = new Map<string, { attendanceRate: number; roundCount: number }>();
  roundStats.forEach(round => {
    if (round.scheduledAt) {
      const date = round.scheduledAt.toISOString().split('T')[0];
      const attendedCount = round.participants.filter(p => 
        p.attendance && ["PRESENT", "LATE"].includes(p.attendance.status)
      ).length;
      const rate = round._count.participants > 0 ? (attendedCount / round._count.participants) * 100 : 0;
      
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { attendanceRate: 0, roundCount: 0 });
      }
      
      const existing = trendsMap.get(date)!;
      existing.attendanceRate = ((existing.attendanceRate * existing.roundCount) + rate) / (existing.roundCount + 1);
      existing.roundCount++;
    }
  });

  // By round type
  const roundTypeMap = new Map<string, { rounds: number; totalRate: number }>();
  roundStats.forEach(round => {
    if (!roundTypeMap.has(round.type)) {
      roundTypeMap.set(round.type, { rounds: 0, totalRate: 0 });
    }
    
    const attendedCount = round.participants.filter(p => 
      p.attendance && ["PRESENT", "LATE"].includes(p.attendance.status)
    ).length;
    const rate = round._count.participants > 0 ? (attendedCount / round._count.participants) * 100 : 0;
    
    const existing = roundTypeMap.get(round.type)!;
    existing.rounds++;
    existing.totalRate += rate;
  });

  // By branch
  const branchMap = new Map<string, { totalStudents: number; presentCount: number }>();
  branchData.forEach(participant => {
    const branchCode = participant.application.student.batch.branch.code;
    
    if (!branchMap.has(branchCode)) {
      branchMap.set(branchCode, { totalStudents: 0, presentCount: 0 });
    }
    
    const existing = branchMap.get(branchCode)!;
    existing.totalStudents++;
    
    if (participant.attendance && ["PRESENT", "LATE"].includes(participant.attendance.status)) {
      existing.presentCount++;
    }
  });

  // Find defaulters (students with low attendance)
  const studentAttendanceMap = new Map<string, {
    student: any;
    totalRounds: number;
    absentCount: number;
  }>();

  branchData.forEach(participant => {
    const studentId = participant.application.student.id;
    
    if (!studentAttendanceMap.has(studentId)) {
      studentAttendanceMap.set(studentId, {
        student: participant.application.student,
        totalRounds: 0,
        absentCount: 0,
      });
    }
    
    const existing = studentAttendanceMap.get(studentId)!;
    existing.totalRounds++;
    
    if (participant.attendance && participant.attendance.status === "ABSENT") {
      existing.absentCount++;
    }
  });

  const defaulters = Array.from(studentAttendanceMap.values())
    .map(data => ({
      studentId: data.student.id,
      enrollmentNumber: data.student.enrollmentNumber,
      name: `${data.student.firstName} ${data.student.lastName}`,
      absentCount: data.absentCount,
      totalRounds: data.totalRounds,
      attendanceRate: data.totalRounds > 0 ? ((data.totalRounds - data.absentCount) / data.totalRounds) * 100 : 0,
    }))
    .filter(student => student.attendanceRate < 75 && student.totalRounds >= 2) // Below 75% with at least 2 rounds
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 20); // Top 20 defaulters

  return {
    overallStats: {
      totalRounds,
      totalParticipants,
      averageAttendanceRate,
      trendsOverTime: Array.from(trendsMap.entries()).map(([date, data]) => ({
        date,
        attendanceRate: data.attendanceRate,
        roundCount: data.roundCount,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    },
    byRoundType: Object.fromEntries(
      Array.from(roundTypeMap.entries()).map(([type, data]) => [
        type,
        {
          rounds: data.rounds,
          averageAttendance: data.rounds > 0 ? data.totalRate / data.rounds : 0,
        },
      ])
    ),
    byBranch: Object.fromEntries(
      Array.from(branchMap.entries()).map(([branch, data]) => [
        branch,
        {
          totalStudents: data.totalStudents,
          averageAttendance: data.totalStudents > 0 ? (data.presentCount / data.totalStudents) * 100 : 0,
        },
      ])
    ),
    defaulters,
  };
}

// ─── Delete Attendance Record ─────────────────────────────────────────────────

export async function deleteAttendanceRecord(id: string): Promise<void> {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new NotFoundError("Attendance record not found");
  }

  await prisma.attendanceRecord.delete({ where: { id } });
}