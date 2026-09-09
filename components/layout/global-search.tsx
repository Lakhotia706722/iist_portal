"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, GraduationCap, Building2, Briefcase, ClipboardList, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResult = {
  type: "student" | "company" | "jobRole" | "application" | "drive";
  id: string;
  title: string;
  subtitle: string;
  link: string;
};

const TYPE_ICON: Record<SearchResult["type"], any> = {
  student: GraduationCap,
  company: Building2,
  jobRole: Briefcase,
  application: ClipboardList,
  drive: CalendarDays,
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Staff-only global search: students, companies, roles, applications, drives. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(debounced)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json() as Promise<{ results: SearchResult[]; scoped: boolean }>;
    },
    enabled: debounced.trim().length >= 2,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = data?.results ?? [];

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search students, companies, drives…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Global search"
          className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && debounced.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-96 overflow-y-auto rounded-xl border bg-popover shadow-lg">
          {isFetching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for &ldquo;{debounced}&rdquo;.</p>
          ) : (
            <ul className="divide-y">
              {results.map((r) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <Link
                      href={r.link}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/60"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground")}>
                        {r.type}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
