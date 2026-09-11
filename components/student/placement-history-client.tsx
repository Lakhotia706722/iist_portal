"use client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { Award, FileText, Building2, CalendarDays, MapPin } from "lucide-react";

type Offer = {
  id: string;
  status: string;
  type: string;
  category: string;
  isPPO: boolean;
  ctc: number | null;
  stipend: number | null;
  ctcBreakdown: string | null;
  location: string | null;
  offerDate: string;
  joiningDate: string | null;
  offerLetterKey: string | null;
  statusNote: string | null;
  company: { id: string; name: string };
  jobRole: { id: string; title: string };
  drive: { id: string; title: string; academicYear: string };
};

async function fetchOffers() {
  const res = await fetch("/api/student/offers");
  if (!res.ok) throw new Error("Failed to load placement history");
  return res.json() as Promise<{ offers: Offer[] }>;
}

export function PlacementHistoryClient() {
  // Live — Phase 15: offers are created/updated by admin/company-rep
  // staff, not this student.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-offers"],
    queryFn: fetchOffers,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) return <LoadingState text="Loading placement history…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const offers = data?.offers ?? [];

  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<Award className="h-10 w-10" />}
        title="No offers yet"
        description="Once you're selected in a drive and the placement cell records your offer, it will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {offers.map((o) => (
        <Card key={o.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{o.company.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {o.jobRole.title} · {o.drive.academicYear}
              </p>
            </div>
            <StatusBadge status={o.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status={o.type} />
            <StatusBadge status={o.category} />
            {o.isPPO && <StatusBadge status="PPO" label="PPO" />}
          </div>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Package</dt>
              <dd className="font-medium">
                {o.ctc != null ? `${o.ctc} LPA` : null}
                {o.ctc != null && o.stipend != null ? " · " : null}
                {o.stipend != null
                  ? `₹${o.stipend.toLocaleString("en-IN")}/month`
                  : null}
                {o.ctc == null && o.stipend == null ? "—" : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Offer date</dt>
              <dd className="flex items-center gap-1 font-medium">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(o.offerDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joining date</dt>
              <dd className="font-medium">
                {o.joiningDate ? formatDate(o.joiningDate) : "To be confirmed"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="flex items-center gap-1 font-medium">
                {o.location ? (
                  <>
                    <MapPin className="h-3.5 w-3.5" />
                    {o.location}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>

          {o.ctcBreakdown && (
            <p className="mt-4 rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Breakdown: </span>
              {o.ctcBreakdown}
            </p>
          )}

          {o.statusNote && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium">
                {formatStatusLabel(o.status)} note:{" "}
              </span>
              {o.statusNote}
            </p>
          )}

          {o.offerLetterKey && (
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/files/${encodeURIComponent(o.offerLetterKey)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View offer letter
                </a>
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
