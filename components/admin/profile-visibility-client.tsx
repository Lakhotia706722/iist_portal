"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Eye, EyeOff, Save, ShieldCheck } from "lucide-react";

type VisibilitySetting = { id: string; fieldKey: string; label: string; isVisible: boolean };

async function fetchSettings(): Promise<VisibilitySetting[]> {
  const res = await fetch("/api/admin/profile-visibility");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export function ProfileVisibilityClient() {
  const qc = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<VisibilitySetting[]>({
    queryKey: ["admin-visibility-settings"],
    queryFn: fetchSettings,
  });

  // Seed local toggle state from server data (only on first load / refetch, not on dirty edits)
  useEffect(() => {
    if (!data) return;
    const map: Record<string, boolean> = {};
    data.forEach((s) => { map[s.fieldKey] = s.isVisible; });
    setLocalSettings(map);
    setDirty(false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const settings = Object.entries(localSettings).map(([fieldKey, isVisible]) => ({ fieldKey, isVisible }));
      const res = await fetch("/api/admin/profile-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-visibility-settings"] });
      setDirty(false);
    },
  });

  function toggle(key: string) {
    setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }

  const sectionSettings = (data ?? []).filter((s) => s.fieldKey.startsWith("section:"));
  const fieldSettings   = (data ?? []).filter((s) => s.fieldKey.startsWith("field:"));

  if (isLoading) return <LoadingState text="Loading visibility settings..." />;
  if (isError)   return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Changes apply immediately to how profiles are displayed to companies and admins.
        </p>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!dirty}>
          <Save className="h-4 w-4" />Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile Sections</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {sectionSettings.map((s) => {
              const isOn = localSettings[s.fieldKey] ?? s.isVisible;
              return (
                <button
                  key={s.fieldKey}
                  onClick={() => toggle(s.fieldKey)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm">{s.label}</span>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${isOn ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {isOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {isOn ? "Visible" : "Hidden"}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sensitive Fields</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              These individual fields are hidden by default to protect student privacy.
            </p>
            <div className="space-y-1">
              {fieldSettings.map((s) => {
                const isOn = localSettings[s.fieldKey] ?? s.isVisible;
                return (
                  <button
                    key={s.fieldKey}
                    onClick={() => toggle(s.fieldKey)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-sm">{s.label}</span>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${isOn ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {isOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {isOn ? "Visible" : "Hidden"}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {saveMutation.error && (
        <p className="text-sm text-destructive">{String(saveMutation.error)}</p>
      )}
    </div>
  );
}
