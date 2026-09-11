"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, CheckCircle, Clock, XCircle } from "lucide-react";

interface Application { status: string }

export function ApplicationsStats({ applications }: { applications: Application[] }) {
  const total = applications.length;
  const pending = applications.filter(a => a.status === "PENDING").length;
  const shortlisted = applications.filter(a => a.status === "SHORTLISTED").length;
  const rejected = applications.filter(a => ["REJECTED", "WITHDRAWN"].includes(a.status)).length;

  const stats = [
    { label: "Total Applied", value: total, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "In Progress", value: pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Shortlisted", value: shortlisted, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Not Progressed", value: rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(s => (
        <Card key={s.label}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
