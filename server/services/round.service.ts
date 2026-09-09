/**
 * Round Service — Phase 3
 *
 * Placement round management with participant tracking,
 * result recording, and automatic shortlisting flow.
 */

import { prisma } from "@/lib/prisma";
import { RoundInput, ParticipantResultInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PlacementNotifications } from "@/lib/notifications";
import { ApplicationStatus } from "@prisma/client";
import { writeAuditLog } from "./audit.service";

export type RoundWithDetails = {
  id: string;
  driveId: string;
  roundNumber: number;
  title: string;
  type: string;
  mode: string;
  scheduledAt: Date | null;
  durationMins: number | null;
  venue: string | null;
  meetingLink: string | null;
  instructions: string | null;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  drive: {
    id: string;
    title: string;
    status: string;
    company: {
      name: string;
    };
  };
  participants: Array<{
    id: string;
    applicationId: string;
    result: string | null;
    remarks: string | null;
    nextAction: string | null;
    createdAt: Date;
    updatedAt: Date;
    application: {
      id: string;
      student: {
        enrollmentNumber: string;
        firstName: string | null;
        lastName: string | null;
      };
    };
    attendance: {
      id: string;
      status: string;
      note: string | null;
    } | null;
  }>;
  _count: {
    participants: number;
  };
};

export type ParticipantWithDetails = {
  id: string;
  roundId: string;
  applicationId: string;
  result: string | null;
  remarks: string | null;
  nextAction: string | null;
  createdAt: Date;
  updatedAt: Date;
  round: {
    title: string;
    type: string;
    scheduledAt: Date | null;
  };
  application: {
    id: string;
    status: string;
    student: {
      enrollmentNumber: string;
      firstName: string | null;
      lastName: string | null;
      batch: {
        academicYear: string;
        branch: {
          code: string;
          name: string;
        };
      };
      academicRecord: {
        currentCgpa: number | null;
      } | null;
    };
    jobRole: {
      title: string;
      drive: {
        title: string;
        company: {
          name: string;
        };
      };
    };
  };
  attendance: {
    id: string;
    status: string;
    note: string | null;
    markedAt: Date;
    markedById: string | null;
  } | null;
};

// ─── Round include helper (keep consistent) ───────────────────────────────────

const roundInclude = {
  drive: {
    select: {
      id: true,
      title: true,
      status: true,
      company: { select: { name: true } },
    },
  },
  participants: {
    include: {
      application: {
        select: {
          id: true,
          student: {
            select: {
              enrollmentNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      attendance: {
        select: {
          id: true,
          status: true,
          note: true,
        },
      },
    },
  },
  _count: {
    select: { participants: true },
  },
} as const;

// ─── Create Round ─────────────────────────────────────────────────────────────

export async function createRound(
  driveId: string,
  data: RoundInput,
  createdById?: string
): Promise<RoundWithDetails> {
  // Validate drive exists and is in appropriate status
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: { id: true, status: true },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  if (!["APPLICATIONS_CLOSED", "ONGOING"].includes(drive.status)) {
    throw new ValidationError("Cannot create rounds for drive in current status");
  }

  // Check for round number uniqueness within the drive
  const existingRound = await prisma.placementRound.findFirst({
    where: { driveId, roundNumber: data.roundNumber },
  });

  if (existingRound) {
    throw new ValidationError(`Round ${data.roundNumber} already exists for this drive`);
  }

  const parsedData = {
    ...data,
    driveId,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
  };

  const round = await prisma.placementRound.create({
    data: parsedData,
    include: roundInclude,
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "PlacementRound",
    entityId: round.id,
    newValues: {
      driveId,
      roundNumber: round.roundNumber,
      title: round.title,
      type: round.type,
      mode: round.mode,
      scheduledAt: round.scheduledAt,
    },
  });

  return round;
}

// ─── Read Rounds ──────────────────────────────────────────────────────────────

export async function listRounds(
  driveId: string,
  filters?: {
    limit?: number;
    offset?: number;
  }
): Promise<{
  rounds: RoundWithDetails[];
  total: number;
}> {
  const [rounds, total] = await Promise.all([
    prisma.placementRound.findMany({
      where: { driveId },
      include: {
        ...roundInclude,
        participants: {
          include: {
            application: {
              select: {
                id: true,
                student: {
                  select: {
                    enrollmentNumber: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            attendance: {
              select: { id: true, status: true, note: true },
            },
          },
          orderBy: [
            { application: { student: { enrollmentNumber: "asc" } } },
          ],
        },
      },
      orderBy: { roundNumber: "asc" },
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.placementRound.count({ where: { driveId } }),
  ]);

  return {
    rounds,
    total,
  };
}

export async function getRoundById(id: string): Promise<RoundWithDetails> {
  const round = await prisma.placementRound.findUnique({
    where: { id },
    include: {
      ...roundInclude,
      participants: {
        include: {
          application: {
            select: {
              id: true,
              student: {
                select: {
                  enrollmentNumber: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          attendance: {
            select: { id: true, status: true, note: true },
          },
        },
        orderBy: [
          { application: { student: { enrollmentNumber: "asc" } } },
        ],
      },
    },
  });

  if (!round) {
    throw new NotFoundError("Round not found");
  }

  return round;
}

// ─── Update Round ─────────────────────────────────────────────────────────────

export async function updateRound(
  id: string,
  data: Partial<RoundInput>
): Promise<RoundWithDetails> {
  const existing = await prisma.placementRound.findUnique({
    where: { id },
    include: { drive: { select: { status: true } } },
  });

  if (!existing) {
    throw new NotFoundError("Round not found");
  }

  if (existing.scheduledAt && existing.scheduledAt < new Date()) {
    throw new ValidationError("Cannot edit round that has already started");
  }

  const parsedData: any = { ...data };
  if (data.scheduledAt) {
    parsedData.scheduledAt = new Date(data.scheduledAt);
  }

  const round = await prisma.placementRound.update({
    where: { id },
    data: parsedData,
    include: roundInclude,
  });

  return round;
}

// ─── Delete Round ─────────────────────────────────────────────────────────────

export async function deleteRound(id: string): Promise<void> {
  const round = await prisma.placementRound.findUnique({
    where: { id },
    include: {
      _count: { select: { participants: true } },
    },
  });

  if (!round) {
    throw new NotFoundError("Round not found");
  }

  if (round._count.participants > 0) {
    throw new ValidationError("Cannot delete round with participants");
  }

  await prisma.placementRound.delete({ where: { id } });
}

// ─── Participant Management ───────────────────────────────────────────────────

export async function addParticipants(
  roundId: string,
  applicationIds: string[]
): Promise<RoundWithDetails> {
  // Only round.driveId (a plain scalar, always present) is actually used
  // below — a `roundFull` query further down separately fetches the
  // company name for notifications. The `drive: { select: {...} } as any`
  // this used to have here was never valid Prisma (driveId isn't a field
  // on PlacementDrive at all) and the `as any` was hiding that — it just
  // happened to never run, because nothing could reach this function
  // before Phase 10 built the first real UI path to it.
  const round = await prisma.placementRound.findUnique({
    where: { id: roundId },
  });

  if (!round) {
    throw new NotFoundError("Round not found");
  }

  const applications = await prisma.application.findMany({
    where: {
      id: { in: applicationIds },
      jobRole: { driveId: round.driveId },
      status: { in: ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND"] as ApplicationStatus[] },
    },
    select: { id: true, studentId: true },
  });

  if (applications.length !== applicationIds.length) {
    throw new ValidationError("Some applications are not found or not in appropriate status");
  }

  const existingParticipants = await prisma.roundParticipant.findMany({
    where: { roundId, applicationId: { in: applicationIds } },
  });

  const newApplicationIds = applicationIds.filter(
    id => !existingParticipants.some(p => p.applicationId === id)
  );

  if (newApplicationIds.length === 0) {
    throw new ValidationError("All applications are already participants");
  }

  await prisma.roundParticipant.createMany({
    data: newApplicationIds.map(applicationId => ({ roundId, applicationId })),
  });

  // Send notifications
  try {
    const roundFull = await prisma.placementRound.findUnique({
      where: { id: roundId },
      select: {
        title: true,
        scheduledAt: true,
        venue: true,
        drive: { select: { company: { select: { name: true } } } },
      },
    });

    if (roundFull?.scheduledAt) {
      const studentIds = applications
        .filter(app => newApplicationIds.includes(app.id))
        .map(app => app.studentId);

      await PlacementNotifications.roundScheduled(
        studentIds,
        roundFull.drive.company.name,
        roundFull.title,
        roundFull.scheduledAt,
        roundFull.venue || undefined
      );
    }
  } catch (error) {
    console.warn("Round notification failed:", error);
  }

  return await getRoundById(roundId);
}

/**
 * Applications for this round's drive that are eligible to be added as
 * participants (shortlisted or further along, per the same status list
 * addParticipants() itself validates against) and aren't already in this
 * round. Phase 10 — this query, the route that exposes it, and the UI that
 * calls it are what close the gap Phase 9 documented: shortlisting and
 * attendance marking were both real, but nothing on the admin side ever
 * connected a shortlisted applicant to a round's participant list.
 */
export async function listRoundEligibleApplications(roundId: string): Promise<
  Array<{
    id: string;
    status: string;
    student: {
      id: string;
      enrollmentNumber: string;
      firstName: string | null;
      lastName: string | null;
      batch: { branch: { code: string } };
    };
    jobRole: { title: string };
  }>
> {
  const round = await prisma.placementRound.findUnique({
    where: { id: roundId },
    select: { driveId: true },
  });
  if (!round) throw new NotFoundError("Round not found");

  const existingParticipants = await prisma.roundParticipant.findMany({
    where: { roundId },
    select: { applicationId: true },
  });
  const existingIds = existingParticipants.map((p) => p.applicationId);

  return prisma.application.findMany({
    where: {
      jobRole: { driveId: round.driveId },
      status: { in: ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND"] as ApplicationStatus[] },
      id: { notIn: existingIds.length > 0 ? existingIds : undefined },
    },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
          batch: { select: { branch: { select: { code: true } } } },
        },
      },
      jobRole: { select: { title: true } },
    },
    orderBy: { student: { enrollmentNumber: "asc" } },
  });
}

export async function removeParticipant(
  roundId: string,
  applicationId: string
): Promise<RoundWithDetails> {
  const participant = await prisma.roundParticipant.findFirst({
    where: { roundId, applicationId },
  });

  if (!participant) {
    throw new NotFoundError("Participant not found in this round");
  }

  await prisma.roundParticipant.delete({ where: { id: participant.id } });

  return await getRoundById(roundId);
}

// ─── Participant Results ──────────────────────────────────────────────────────

export async function updateParticipantResult(
  participantId: string,
  data: ParticipantResultInput
): Promise<ParticipantWithDetails> {
  const participant = await prisma.roundParticipant.findUnique({
    where: { id: participantId },
    include: {
      round: { select: { type: true } },
    },
  });

  if (!participant) {
    throw new NotFoundError("Participant not found");
  }

  await prisma.roundParticipant.update({
    where: { id: participantId },
    data: {
      result: data.result || null,
      remarks: data.remarks || null,
      nextAction: data.nextAction || null,
    },
  });

  // Auto-update application status based on result
  if (data.result && ["PASS", "FAIL"].includes(data.result)) {
    try {
      if (data.result === "PASS") {
        const nextStatus = getNextApplicationStatus(participant.round.type);
        if (nextStatus) {
          await prisma.application.update({
            where: { id: participant.applicationId },
            data: { status: nextStatus as ApplicationStatus },
          });
        }
      } else if (data.result === "FAIL") {
        await prisma.application.update({
          where: { id: participant.applicationId },
          data: { status: "REJECTED" as ApplicationStatus },
        });
      }
    } catch (error) {
      console.warn("Auto-status update failed:", error);
    }
  }

  return await getParticipantById(participantId);
}

export async function getParticipantById(id: string): Promise<ParticipantWithDetails> {
  const participant = await prisma.roundParticipant.findUnique({
    where: { id },
    include: {
      round: {
        select: {
          title: true,
          type: true,
          scheduledAt: true,
        },
      },
      application: {
        select: {
          id: true,
          status: true,
          student: {
            select: {
              enrollmentNumber: true,
              firstName: true,
              lastName: true,
              batch: {
                select: {
                  academicYear: true,
                  branch: { select: { code: true, name: true } },
                },
              },
              academicRecord: {
                select: { currentCgpa: true },
              },
            },
          },
          jobRole: {
            select: {
              title: true,
              drive: {
                select: {
                  title: true,
                  company: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      attendance: {
        select: {
          id: true,
          status: true,
          note: true,
          markedAt: true,
          markedById: true,
        },
      },
    },
  });

  if (!participant) {
    throw new NotFoundError("Participant not found");
  }

  return participant;
}

// ─── Bulk Result Updates ──────────────────────────────────────────────────────

export async function bulkUpdateParticipantResults(
  roundId: string,
  updates: Array<{
    participantId: string;
    result?: string;
    remarks?: string;
    nextAction?: string;
  }>
): Promise<RoundWithDetails> {
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.roundParticipant.update({
        where: { id: update.participantId },
        data: {
          result: update.result || null,
          remarks: update.remarks || null,
          nextAction: update.nextAction || null,
        },
      });

      if (update.result && ["PASS", "FAIL"].includes(update.result)) {
        const participant = await tx.roundParticipant.findUnique({
          where: { id: update.participantId },
          include: { round: { select: { type: true } } },
        });

        if (participant) {
          if (update.result === "PASS") {
            const nextStatus = getNextApplicationStatus(participant.round.type);
            if (nextStatus) {
              await tx.application.update({
                where: { id: participant.applicationId },
                data: { status: nextStatus as ApplicationStatus },
              });
            }
          } else if (update.result === "FAIL") {
            await tx.application.update({
              where: { id: participant.applicationId },
              data: { status: "REJECTED" as ApplicationStatus },
            });
          }
        }
      }
    }
  });

  return await getRoundById(roundId);
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function markAttendance(
  participantId: string,
  status: string,
  markedById: string,
  note?: string
): Promise<void> {
  const participant = await prisma.roundParticipant.findUnique({
    where: { id: participantId },
    include: { attendance: true },
  });

  if (!participant) {
    throw new NotFoundError("Participant not found");
  }

  if (participant.attendance) {
    await prisma.attendanceRecord.update({
      where: { roundParticipantId: participantId },
      data: { status: status as any, note, markedById },
    });
  } else {
    await prisma.attendanceRecord.create({
      data: {
        roundParticipantId: participantId,
        status: status as any,
        note,
        markedById,
      },
    });
  }
}

// ─── Round Statistics ─────────────────────────────────────────────────────────

export async function getRoundStats(roundId: string): Promise<{
  totalParticipants: number;
  attendanceStats: Record<string, number>;
  resultStats: Record<string, number>;
  passRate: number;
}> {
  const [participants, attendance, results] = await Promise.all([
    prisma.roundParticipant.count({ where: { roundId } }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { roundParticipant: { roundId } },
      _count: { _all: true },
    }),
    prisma.roundParticipant.groupBy({
      by: ["result"],
      where: { roundId, result: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const passCount = results.find(r => r.result === "PASS")?._count._all || 0;
  const totalResults = results.reduce((sum, r) => sum + r._count._all, 0);

  return {
    totalParticipants: participants,
    attendanceStats: attendance.reduce(
      (acc, item) => ({ ...acc, [item.status]: item._count._all }),
      {}
    ),
    resultStats: results.reduce(
      (acc, item) => ({ ...acc, [item.result || "PENDING"]: item._count._all }),
      {}
    ),
    passRate: totalResults > 0 ? (passCount / totalResults) * 100 : 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextApplicationStatus(roundType: string): string | null {
  const progressionMap: Record<string, string> = {
    WRITTEN_TEST: "TECHNICAL_ROUND",
    APTITUDE_TEST: "TECHNICAL_ROUND",
    CODING_TEST: "TECHNICAL_ROUND",
    TECHNICAL_INTERVIEW: "HR_ROUND",
    HR_INTERVIEW: "SELECTED",
    FINAL_ROUND: "SELECTED",
    PRESENTATION: "HR_ROUND",
    GROUP_DISCUSSION: "TECHNICAL_ROUND",
  };

  return progressionMap[roundType] || null;
}
