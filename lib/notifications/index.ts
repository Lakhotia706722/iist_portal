/**
 * Notification System Stub — Phase 3
 *
 * Centralized notification dispatcher called from automation hooks.
 * Logs all notification events for now. Future phases will add:
 *   - Email integration (nodemailer/resend)
 *   - SMS/WhatsApp (Twilio)
 *   - In-app notifications
 *   - Push notifications
 */

export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface NotificationPayload {
  // Recipients
  userId?:      string;       // Single user ID
  userIds?:     string[];     // Multiple user IDs
  roleFilter?:  string[];     // Send to all users with these roles
  
  // Content
  subject:      string;
  message:      string;
  template?:    string;       // Template name for rich formatting
  data?:        Record<string, any>; // Template variables
  
  // Delivery
  channels:     NotificationChannel[];
  priority:     NotificationPriority;
  scheduledAt?: Date;         // Future delivery
  
  // Context
  category:     string;       // e.g. "placement", "profile", "system"
  entityType?:  string;       // e.g. "drive", "application", "round"
  entityId?:    string;       // Related entity ID for tracking
}

// ─── Main notification dispatcher ─────────────────────────────────────────────

export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    // Log all notification attempts for audit trail
    console.log("[NOTIFICATION]", {
      timestamp: new Date().toISOString(),
      category: payload.category,
      channels: payload.channels,
      priority: payload.priority,
      subject: payload.subject,
      recipients: {
        userId: payload.userId,
        userIds: payload.userIds?.length,
        roleFilter: payload.roleFilter,
      },
      entityType: payload.entityType,
      entityId: payload.entityId,
    });

    // TODO Phase 4+: Actual delivery implementation
    // - Queue jobs for each channel
    // - Handle scheduling/retries
    // - Store delivery receipts
    // - Track user preferences/unsubscribes

  } catch (error) {
    console.error("[NOTIFICATION_ERROR]", {
      error: error instanceof Error ? error.message : "Unknown error",
      payload: { ...payload, data: "[redacted]" },
    });
    
    // Don't throw — notifications should not break business logic
  }
}

// ─── Pre-built notification helpers ───────────────────────────────────────────

export const PlacementNotifications = {
  // Company/Drive lifecycle
  drivePublished: (driveId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "drive",
      entityId: driveId,
      subject: `New Opportunity: ${title}`,
      message: `${companyName} has published a new placement drive: ${title}. Check eligibility and apply now!`,
      channels: ["email", "in_app"],
      priority: "high",
      roleFilter: ["STUDENT"],
    }),

  applicationsOpening: (driveId: string, title: string, openAt: Date) =>
    notify({
      category: "placement",
      entityType: "drive",
      entityId: driveId,
      subject: `Applications Opening: ${title}`,
      message: `Applications for ${title} will open on ${openAt.toLocaleDateString()}. Make sure your profile and resume are ready!`,
      channels: ["email", "in_app"],
      priority: "normal",
      roleFilter: ["STUDENT"],
      scheduledAt: new Date(openAt.getTime() - 24 * 60 * 60 * 1000), // 24h before
    }),

  applicationsClosing: (driveId: string, title: string, closeAt: Date) =>
    notify({
      category: "placement",
      entityType: "drive", 
      entityId: driveId,
      subject: `Last Chance: ${title}`,
      message: `Applications for ${title} close on ${closeAt.toLocaleDateString()}. Apply before it's too late!`,
      channels: ["email", "in_app"],
      priority: "high",
      roleFilter: ["STUDENT"],
      scheduledAt: new Date(closeAt.getTime() - 6 * 60 * 60 * 1000), // 6h before
    }),

  // Application lifecycle
  applicationReceived: (userId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      userId,
      subject: `Application Received: ${title}`,
      message: `Your application for ${title} at ${companyName} has been received. You'll be notified of further updates.`,
      channels: ["email", "in_app"],
      priority: "normal",
    }),

  statusChanged: (userId: string, companyName: string, title: string, newStatus: string) =>
    notify({
      category: "placement",
      entityType: "application",
      userId,
      subject: `Update: ${title}`,
      message: `Your application status for ${title} at ${companyName} has been updated to: ${newStatus}`,
      channels: ["email", "in_app"],
      priority: "high",
    }),

  shortlisted: (userId: string, companyName: string, title: string, nextRound?: string) =>
    notify({
      category: "placement",
      entityType: "application",
      userId,
      subject: `🎉 Shortlisted: ${title}`,
      message: `Congratulations! You've been shortlisted for ${title} at ${companyName}.${nextRound ? ` Next: ${nextRound}` : ""}`,
      channels: ["email", "in_app"],
      priority: "high",
    }),

  // Round management
  roundScheduled: (userIds: string[], companyName: string, roundTitle: string, scheduledAt: Date, venue?: string) =>
    notify({
      category: "placement",
      entityType: "round",
      userIds,
      subject: `Round Scheduled: ${roundTitle}`,
      message: `${roundTitle} for ${companyName} is scheduled for ${scheduledAt.toLocaleString()}.${venue ? ` Venue: ${venue}` : ""} Be prepared!`,
      channels: ["email", "in_app"],
      priority: "high",
    }),

  roundReminder: (userIds: string[], roundTitle: string, scheduledAt: Date, venue?: string) =>
    notify({
      category: "placement",
      entityType: "round",
      userIds,
      subject: `Reminder: ${roundTitle} Tomorrow`,
      message: `Reminder: ${roundTitle} is scheduled tomorrow at ${scheduledAt.toLocaleString()}.${venue ? ` Venue: ${venue}` : ""}`,
      channels: ["email", "in_app"],
      priority: "high",
      scheduledAt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
    }),

  // Final outcomes
  selected: (userId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      userId,
      subject: `🎊 Selected: ${title}`,
      message: `Congratulations! You have been selected for ${title} at ${companyName}. Please wait for further instructions.`,
      channels: ["email", "in_app", "sms"],
      priority: "critical",
    }),

  rejected: (userId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      userId,
      subject: `Update: ${title}`,
      message: `Thank you for applying to ${title} at ${companyName}. Unfortunately, we won't be moving forward with your application this time.`,
      channels: ["email", "in_app"],
      priority: "normal",
    }),
};

export const AdminNotifications = {
  applicationReceived: (driveTitle: string, studentName: string, count: number) =>
    notify({
      category: "placement",
      entityType: "application",
      subject: `New Application: ${driveTitle}`,
      message: `${studentName} has applied to ${driveTitle}. Total applications: ${count}`,
      channels: ["in_app"],
      priority: "low",
      roleFilter: ["ADMIN", "PLACEMENT_OFFICER"],
    }),

  driveDeadlineApproaching: (driveTitle: string, closeAt: Date, applicationCount: number) =>
    notify({
      category: "placement",
      entityType: "drive",
      subject: `Drive Closing Soon: ${driveTitle}`,
      message: `${driveTitle} applications close in 24 hours. Current applications: ${applicationCount}`,
      channels: ["email", "in_app"],
      priority: "normal",
      roleFilter: ["ADMIN", "PLACEMENT_OFFICER"],
      scheduledAt: new Date(closeAt.getTime() - 24 * 60 * 60 * 1000),
    }),
};

// ─── Export default ───────────────────────────────────────────────────────────

export { notify as default };