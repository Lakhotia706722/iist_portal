import {
  LayoutDashboard,
  User,
  FileText,
  Briefcase,
  ClipboardList,
  Route,
  BookOpen,
  Mic2,
  FolderOpen,
  Bell,
  CalendarDays,
  Settings,
  Users,
  Building2,
  GraduationCap,
  Building,
  Award,
  BarChart3,
  ShieldCheck,
  ClipboardCheck,
  ListChecks,
  UserCog,
  ScrollText,
  Layers,
  Code2,
  FolderGit2,
  Trophy,
  Globe,
  Video,
  Star,
  Sparkles,
  ShieldAlert,
  Search,
} from "lucide-react";
import type { NavGroup } from "./sidebar";

export const STUDENT_NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "My Profile",
    items: [
      { label: "Career Profile", href: "/student/profile/career", icon: Star },
      { label: "Personal & Academic", href: "/student/profile", icon: User },
      { label: "Skills", href: "/student/profile/skills", icon: Code2 },
      { label: "Projects", href: "/student/profile/projects", icon: FolderGit2 },
      { label: "Internships", href: "/student/profile/internships", icon: Briefcase },
      { label: "Certifications", href: "/student/profile/certifications", icon: Award },
      { label: "Achievements", href: "/student/profile/achievements", icon: Trophy },
      { label: "Social & Video", href: "/student/profile/social", icon: Globe },
    ],
  },
  {
    title: "Career Center",
    items: [
      { label: "Resume Center", href: "/student/resume", icon: FileText },
      { label: "Documents", href: "/student/documents", icon: FolderOpen },
    ],
  },
  {
    title: "Placements",
    items: [
      { label: "Opportunities", href: "/student/opportunities", icon: Briefcase },
      { label: "My Applications", href: "/student/applications", icon: ClipboardList },
      { label: "Journey Tracker", href: "/student/journey", icon: Route },
      { label: "Placement History", href: "/student/placement-history", icon: Award },
      { label: "Compliance Status", href: "/student/compliance", icon: ShieldCheck },
    ],
  },
  {
    title: "Career Development",
    items: [
      { label: "Skill Up", href: "/student/skillup", icon: BookOpen },
      { label: "Mock Interviews", href: "/student/mock-interviews", icon: Mic2 },
      { label: "AI Resume Builder", href: "/student/ai-resume-builder", icon: Sparkles },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Notifications", href: "/student/notifications", icon: Bell },
      { label: "Calendar", href: "/student/calendar", icon: CalendarDays },
      { label: "Settings", href: "/student/settings", icon: Settings },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "People",
    items: [
      { label: "Students", href: "/admin/students", icon: GraduationCap },
      { label: "Users & Roles", href: "/admin/users-roles", icon: UserCog },
    ],
  },
  {
    title: "Placements",
    items: [
      { label: "Companies", href: "/admin/companies", icon: Building2 },
      { label: "Drives", href: "/admin/drives", icon: Briefcase },
      { label: "Applications", href: "/admin/applications", icon: ClipboardList },
      { label: "Shortlisting", href: "/admin/shortlisting", icon: ListChecks },
      { label: "Rounds", href: "/admin/rounds", icon: Layers },
      { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
      { label: "Offers", href: "/admin/offers", icon: Award },
    ],
  },
  {
    title: "Career Dev",
    items: [
      { label: "Skill Up", href: "/admin/skillup", icon: BookOpen },
      { label: "Mock Interviews", href: "/admin/mock-interviews", icon: Mic2 },
    ],
  },
  {
    title: "Reporting",
    items: [
      { label: "Reports", href: "/admin/reports", icon: ScrollText },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Compliance", href: "/admin/compliance", icon: ShieldCheck },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
  {
    title: "Config",
    items: [
      { label: "Departments", href: "/admin/departments", icon: Building },
      { label: "Skills Catalog", href: "/admin/skills", icon: Code2 },
      { label: "Policy Rules", href: "/admin/policy", icon: ShieldCheck },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "Documents", href: "/admin/documents", icon: FolderOpen },
      { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
      { label: "Video Profiles", href: "/admin/video-profiles", icon: Video },
      { label: "Profile Visibility", href: "/admin/settings/profile-visibility", icon: Star },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export const FACULTY_NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/faculty/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Placements",
    items: [
      { label: "Students", href: "/faculty/students", icon: GraduationCap },
      { label: "Drives", href: "/faculty/drives", icon: Briefcase },
      { label: "Applications", href: "/faculty/applications", icon: ClipboardList },
      { label: "Attendance", href: "/faculty/attendance", icon: ClipboardCheck },
    ],
  },
  {
    title: "Career Dev",
    items: [
      { label: "SkillUp", href: "/faculty/skillup", icon: BookOpen },
      { label: "Mock Interviews", href: "/faculty/mock-interviews", icon: Mic2 },
    ],
  },
  {
    title: "Reporting",
    items: [
      { label: "Reports", href: "/faculty/reports", icon: BarChart3 },
    ],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export const HOD_NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/hod/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Placements",
    items: [
      { label: "Students", href: "/hod/students", icon: GraduationCap },
      { label: "Compliance", href: "/hod/compliance", icon: ShieldCheck },
      { label: "Drives", href: "/hod/drives", icon: Briefcase },
      { label: "Applications", href: "/hod/applications", icon: ClipboardList },
      { label: "Offers", href: "/hod/offers", icon: Award },
    ],
  },
  {
    title: "Reporting",
    items: [
      { label: "Reports", href: "/hod/reports", icon: BarChart3 },
      { label: "Analytics", href: "/hod/analytics", icon: BarChart3 },
      { label: "Audit Logs", href: "/hod/audit-logs", icon: ScrollText },
    ],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export const COMPANY_NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/company/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Recruitment",
    items: [
      // "Job Postings" / a standalone drives list intentionally isn't a
      // separate nav entry — the dashboard already lists every drive with a
      // link into its scoped detail view, which is where applicants live.
      { label: "Offers", href: "/company/offers", icon: Award },
    ],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];
