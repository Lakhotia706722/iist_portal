"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { IISTLogo } from "@/components/shared/iist-logo";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  /** Route not built yet — rendered as a disabled "Soon" item, never a dead link. */
  comingSoon?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  navGroups: NavGroup[];
  /** Mobile slide-out drawer visibility — desktop rendering is unaffected. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavList({
  navGroups,
  pathname,
  collapsed,
  onItemClick,
}: {
  navGroups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
      {navGroups.map((group, gi) => (
        <div key={gi}>
          {group.title && !collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;

              if (item.comingSoon) {
                return (
                  <li key={item.href}>
                    <span
                      aria-disabled="true"
                      title={collapsed ? `${item.label} — coming soon` : "Coming soon"}
                      className={cn(
                        "flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-sidebar-foreground/35",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="ml-auto rounded-full border border-sidebar-foreground/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                            Soon
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                );
              }

              const active =
                item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge != null && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2.5 overflow-hidden", collapsed && "justify-center")}
    >
      <IISTLogo size={32} className="rounded-full bg-white p-0.5" />
      {!collapsed && (
        <div className="leading-tight overflow-hidden">
          <p className="text-sm font-bold text-sidebar-foreground truncate">IIST</p>
          <p className="text-[10px] text-sidebar-foreground/60 truncate">Placement Portal</p>
        </div>
      )}
    </Link>
  );
}

export function Sidebar({ navGroups, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Lock background scroll while the mobile drawer is open — otherwise the
  // page behind it keeps scrolling under a touch drag, which reads as
  // broken on a phone even though the drawer itself is working fine.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Close the drawer on Escape, and whenever the route actually changes
  // (covers back/forward navigation, not just an in-drawer link click).
  useEffect(() => {
    if (!mobileOpen || !onMobileClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile slide-out drawer — always full nav, ignores the desktop
          collapse toggle (a power-user affordance that doesn't apply once
          the drawer just closes after use anyway). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside
            className="relative z-50 flex h-full w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl"
            role="dialog"
            aria-modal
            aria-label="Navigation menu"
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3 shrink-0">
              <Logo collapsed={false} />
              <button
                onClick={onMobileClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList navGroups={navGroups} pathname={pathname} collapsed={false} onItemClick={onMobileClose} />
          </aside>
        </div>
      )}

      {/* Desktop persistent sidebar — unchanged from before. */}
      <aside
        className={cn(
          "relative hidden md:flex h-screen flex-col border-r transition-all duration-200",
          "bg-sidebar text-sidebar-foreground",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-3 shrink-0">
          <Logo collapsed={collapsed} />
        </div>

        <NavList navGroups={navGroups} pathname={pathname} collapsed={collapsed} />

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  );
}
