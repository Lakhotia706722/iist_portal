/**
 * Email template registry — Phase 4
 *
 * These are the built-in defaults. A T&P admin can override any of them by
 * editing the matching EmailTemplate row (same `key`); the DB row wins.
 * Bodies use {{placeholder}} and are rendered with interpolateTemplate().
 */

export interface EmailTemplateDefinition {
  key: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
}

/** Placeholders every template can rely on. */
const COMMON_VARS = ["studentName", "portalUrl"];

function layout(body: string) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="border-bottom:2px solid #1e40af;padding-bottom:12px;margin-bottom:20px">
    <strong style="font-size:16px;color:#1e40af">IIST Placement Cell</strong>
  </div>
  ${body}
  <p style="margin-top:28px;font-size:12px;color:#666;border-top:1px solid #eee;padding-top:12px">
    This is an automated message from the IIST Career Development &amp; Placement Portal.
  </p>
</div>`;
}

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    key: "new_opportunity",
    name: "New Opportunity Published",
    description: "Sent to eligible students when a drive is published.",
    subject: "New opportunity: {{roleTitle}} at {{companyName}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "deadline", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p><strong>{{companyName}}</strong> is hiring for <strong>{{roleTitle}}</strong>.</p>
<p>Applications close on <strong>{{deadline}}</strong>.</p>
<p><a href="{{link}}">View the opportunity and check your eligibility</a></p>`),
  },
  {
    key: "application_confirmation",
    name: "Application Confirmation",
    description: "Sent when a student successfully applies to a role.",
    subject: "Application received: {{roleTitle}} at {{companyName}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "appliedAt", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Your application for <strong>{{roleTitle}}</strong> at <strong>{{companyName}}</strong> was received on {{appliedAt}}.</p>
<p>You will be notified as your application progresses.</p>
<p><a href="{{link}}">Track your applications</a></p>`),
  },
  {
    key: "deadline_reminder",
    name: "Application Deadline Reminder",
    description: "Reminder before applications close.",
    subject: "Closing soon: {{roleTitle}} at {{companyName}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "deadline", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Applications for <strong>{{roleTitle}}</strong> at <strong>{{companyName}}</strong> close on <strong>{{deadline}}</strong>.</p>
<p><a href="{{link}}">Apply before the deadline</a></p>`),
  },
  {
    key: "shortlisted",
    name: "Shortlisted",
    description: "Sent when a student is shortlisted.",
    subject: "You have been shortlisted for {{roleTitle}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "nextRound", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Congratulations — you have been shortlisted for <strong>{{roleTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
<p>{{nextRound}}</p>
<p><a href="{{link}}">View details</a></p>`),
  },
  {
    key: "test_scheduled",
    name: "Test / Interview Scheduled",
    description: "Sent when a SkillUp test or interview is scheduled.",
    subject: "{{eventTitle}} scheduled for {{date}}",
    variables: [...COMMON_VARS, "eventTitle", "date", "time", "venue", "instructions", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p><strong>{{eventTitle}}</strong> has been scheduled.</p>
<table style="font-size:14px;margin:12px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>{{date}}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>{{time}}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Venue</td><td><strong>{{venue}}</strong></td></tr>
</table>
<p>{{instructions}}</p>
<p><a href="{{link}}">View in the portal</a></p>`),
  },
  {
    key: "attendance_status",
    name: "Attendance Recorded",
    description: "Sent when attendance is marked for a round.",
    subject: "Attendance recorded for {{roundTitle}}",
    variables: [...COMMON_VARS, "roundTitle", "companyName", "attendanceStatus", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Your attendance for <strong>{{roundTitle}}</strong> ({{companyName}}) was recorded as
<strong>{{attendanceStatus}}</strong>.</p>
<p>If this looks wrong, contact the placement cell immediately.</p>
<p><a href="{{link}}">View your journey</a></p>`),
  },
  {
    key: "round_result",
    name: "Round Result",
    description: "Sent when a round result is published.",
    subject: "Result for {{roundTitle}} — {{companyName}}",
    variables: [...COMMON_VARS, "roundTitle", "companyName", "result", "remarks", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Your result for <strong>{{roundTitle}}</strong> at <strong>{{companyName}}</strong>: <strong>{{result}}</strong>.</p>
<p>{{remarks}}</p>
<p><a href="{{link}}">View details</a></p>`),
  },
  {
    key: "next_round",
    name: "Next Round Scheduled",
    description: "Sent when a student advances to the next round.",
    subject: "Next round: {{roundTitle}} on {{date}}",
    variables: [...COMMON_VARS, "roundTitle", "companyName", "date", "time", "venue", "instructions", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>You have advanced to <strong>{{roundTitle}}</strong> for <strong>{{companyName}}</strong>.</p>
<table style="font-size:14px;margin:12px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>{{date}}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>{{time}}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Venue</td><td><strong>{{venue}}</strong></td></tr>
</table>
<p>{{instructions}}</p>
<p><a href="{{link}}">View details</a></p>`),
  },
  {
    key: "selected",
    name: "Selection",
    description: "Sent when a student is selected.",
    subject: "Congratulations — selected for {{roleTitle}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Congratulations! You have been <strong>selected</strong> for <strong>{{roleTitle}}</strong> at
<strong>{{companyName}}</strong>.</p>
<p>The placement cell will share offer details shortly.</p>
<p><a href="{{link}}">View your placement history</a></p>`),
  },
  {
    key: "rejected",
    name: "Application Not Progressed",
    description: "Sent when an application is rejected.",
    subject: "Update on your application for {{roleTitle}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Thank you for applying for <strong>{{roleTitle}}</strong> at <strong>{{companyName}}</strong>.
On this occasion your application will not be progressing further.</p>
<p>Keep an eye on the portal — new opportunities are posted regularly.</p>
<p><a href="{{link}}">Browse opportunities</a></p>`),
  },
  {
    key: "offer",
    name: "Offer Recorded",
    description: "Sent when an offer is recorded for a student.",
    subject: "Offer from {{companyName}}",
    variables: [...COMMON_VARS, "companyName", "roleTitle", "ctc", "joiningDate", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>An offer from <strong>{{companyName}}</strong> for <strong>{{roleTitle}}</strong> has been recorded.</p>
<table style="font-size:14px;margin:12px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Package</td><td><strong>{{ctc}}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Joining</td><td><strong>{{joiningDate}}</strong></td></tr>
</table>
<p><a href="{{link}}">View your placement history</a></p>`),
  },
  {
    key: "document_request",
    name: "Document Requested",
    description: "Sent when an admin requests or rejects a document.",
    subject: "Action needed: {{documentName}}",
    variables: [...COMMON_VARS, "documentName", "reason", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>The placement cell needs you to re-upload <strong>{{documentName}}</strong>.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p><a href="{{link}}">Upload the document</a></p>`),
  },
  {
    key: "policy_violation",
    name: "Policy Violation",
    description: "Sent when a placement policy violation is recorded.",
    subject: "Placement policy notice",
    variables: [...COMMON_VARS, "violation", "consequence", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>A placement policy issue has been recorded against your account.</p>
<p><strong>Issue:</strong> {{violation}}</p>
<p><strong>Consequence:</strong> {{consequence}}</p>
<p>Contact the placement cell if you believe this is an error.</p>
<p><a href="{{link}}">Open the portal</a></p>`),
  },
  {
    key: "skillup_result",
    name: "SkillUp Result Published",
    description: "Sent when a test result is published for a student.",
    subject: "Result published: {{testTitle}}",
    variables: [...COMMON_VARS, "testTitle", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Your result for <strong>{{testTitle}}</strong> is now available.</p>
<p><a href="{{link}}">View your result</a></p>`),
  },
  {
    key: "interview_feedback",
    name: "Mock Interview Feedback",
    description: "Sent when a mock interview scorecard is recorded.",
    subject: "Your mock interview feedback is ready",
    variables: [...COMMON_VARS, "interviewer", "overallScore", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>Feedback from your mock interview with <strong>{{interviewer}}</strong> is now available
(overall score <strong>{{overallScore}}/10</strong>).</p>
<p><a href="{{link}}">Read the full feedback</a></p>`),
  },
  {
    key: "announcement",
    name: "General Announcement",
    description: "Free-form announcement from the placement cell.",
    subject: "{{announcementTitle}}",
    variables: [...COMMON_VARS, "announcementTitle", "announcementBody", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>{{announcementBody}}</p>
<p><a href="{{link}}">Open the portal</a></p>`),
  },
  {
    key: "generic",
    name: "Generic Notification",
    description: "Fallback used when a notification has no specific template.",
    subject: "{{subject}}",
    variables: [...COMMON_VARS, "subject", "message", "link"],
    bodyHtml: layout(`<p>Hi {{studentName}},</p>
<p>{{message}}</p>
<p><a href="{{link}}">Open the portal</a></p>`),
  },
];

export const TEMPLATE_KEYS = EMAIL_TEMPLATES.map((t) => t.key);

export function getBuiltInTemplate(key: string): EmailTemplateDefinition | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}
