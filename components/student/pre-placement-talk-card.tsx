/**
 * Pre-placement Talk Card
 * Shown on the student opportunity detail page when the admin has
 * configured a pre-placement talk for the drive; hidden otherwise.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, MapPin, Video, Clock } from "lucide-react";

interface PrePlacementTalkCardProps {
  prePlacementTalk?: {
    scheduledAt: string;
    durationMins: number | null;
    venue: string | null;
    meetingLink: string | null;
    instructions: string | null;
    faq: string | null;
  } | null;
}

export function PrePlacementTalkCard({ prePlacementTalk }: PrePlacementTalkCardProps) {
  if (!prePlacementTalk) {
    return null;
  }

  const scheduledAtLabel = new Date(prePlacementTalk.scheduledAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Pre-placement Talk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Date & Time</h4>
            <p className="text-sm">{scheduledAtLabel}</p>
          </div>

          {prePlacementTalk.durationMins && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Duration
              </h4>
              <p className="text-sm">{prePlacementTalk.durationMins} minutes</p>
            </div>
          )}
        </div>

        {(prePlacementTalk.venue || prePlacementTalk.meetingLink) && (
          <>
            <Separator />
            <div>
              {prePlacementTalk.venue && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{prePlacementTalk.venue}</span>
                </div>
              )}
              {prePlacementTalk.meetingLink && (
                <div className="flex items-start gap-2 text-sm">
                  <Video className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <a
                    href={prePlacementTalk.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {prePlacementTalk.meetingLink}
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {prePlacementTalk.instructions && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Instructions</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {prePlacementTalk.instructions}
              </p>
            </div>
          </>
        )}

        {prePlacementTalk.faq && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">FAQ</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {prePlacementTalk.faq}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
