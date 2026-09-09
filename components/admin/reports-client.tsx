"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";

type ReportMeta = { key: string; label: string };

const FORMATS: Array<{ format: "csv" | "xlsx" | "pdf"; label: string; icon: any }> = [
  { format: "csv", label: "CSV", icon: FileDown },
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText },
];

export function ReportsClient() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports");
      if (!res.ok) throw new Error("Failed to load report catalog");
      return res.json() as Promise<{ reports: ReportMeta[] }>;
    },
  });

  if (isLoading) return <LoadingState text="Loading reports…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data!.reports.map((r) => (
        <Card key={r.key} className="flex flex-col justify-between p-5">
          <div>
            <p className="font-medium">{r.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.key}</p>
          </div>
          <div className="mt-4 flex gap-2">
            {FORMATS.map(({ format, label, icon: Icon }) => (
              <Button key={format} variant="outline" size="sm" asChild>
                <a href={`/api/admin/reports/${r.key}?format=${format}`}>
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {label}
                </a>
              </Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
