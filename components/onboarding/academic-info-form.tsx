"use client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { academicInfoSchema, type AcademicInfoInput } from "@/lib/validations/student";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  defaultValues?: any;
  onSuccess: () => void;
  onBack: () => void;
}

export function AcademicInfoForm({ defaultValues, onSuccess, onBack }: Props) {
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AcademicInfoInput>({
    resolver: zodResolver(academicInfoSchema) as any,
    defaultValues: {
      tenthSchool: defaultValues?.tenthSchool ?? "",
      tenthBoard: defaultValues?.tenthBoard ?? "",
      tenthYear: defaultValues?.tenthYear ?? new Date().getFullYear() - 6,
      tenthPercentage: defaultValues?.tenthPercentage ?? undefined,
      twelfthSchool: defaultValues?.twelfthSchool ?? "",
      twelfthBoard: defaultValues?.twelfthBoard ?? "",
      twelfthYear: defaultValues?.twelfthYear ?? new Date().getFullYear() - 4,
      twelfthPercentage: defaultValues?.twelfthPercentage ?? undefined,
      twelfthStream: defaultValues?.twelfthStream ?? "Science",
      currentCgpa: defaultValues?.currentCgpa ?? undefined,
      currentSemester: defaultValues?.currentSemester ?? 1,
      totalBacklogs: defaultValues?.totalBacklogs ?? 0,
      activeBacklogs: defaultValues?.activeBacklogs ?? 0,
      jeeMainRank: defaultValues?.jeeMainRank ?? undefined,
      jeeAdvancedRank: defaultValues?.jeeAdvancedRank ?? undefined,
      sgpaRecords: defaultValues?.sgpaRecords?.length
        ? defaultValues.sgpaRecords
        : [{ semester: 1, sgpa: undefined as any, backlogs: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "sgpaRecords" });

  async function onSubmit(data: AcademicInfoInput) {
    setError("");
    try {
      const res = await fetch("/api/students/onboarding/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body?.error?.message ?? "Failed to save. Please try again.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 10th Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Class X (10th)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="School Name" required error={errors.tenthSchool?.message} htmlFor="tenthSchool">
              <Input id="tenthSchool" placeholder="School name" {...register("tenthSchool")} />
            </FormField>
            <FormField label="Board" required error={errors.tenthBoard?.message} htmlFor="tenthBoard">
              <Select id="tenthBoard" {...register("tenthBoard")}>
                <option value="">Select board...</option>
                {["CBSE", "ICSE", "State Board", "IB", "Other"].map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Year of Passing" required error={errors.tenthYear?.message} htmlFor="tenthYear">
              <Input id="tenthYear" type="number" min={1990} max={new Date().getFullYear()} {...register("tenthYear", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Percentage (%)" required error={errors.tenthPercentage?.message} htmlFor="tenthPct" hint="0 – 100">
              <Input id="tenthPct" type="number" step="0.01" min={0} max={100} placeholder="e.g. 92.5" {...register("tenthPercentage", { valueAsNumber: true })} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* 12th Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Class XII (12th)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="School Name" required error={errors.twelfthSchool?.message} htmlFor="twelfthSchool">
              <Input id="twelfthSchool" placeholder="School name" {...register("twelfthSchool")} />
            </FormField>
            <FormField label="Board" required error={errors.twelfthBoard?.message} htmlFor="twelfthBoard">
              <Select id="twelfthBoard" {...register("twelfthBoard")}>
                <option value="">Select board...</option>
                {["CBSE", "ICSE", "State Board", "IB", "Other"].map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Year of Passing" required error={errors.twelfthYear?.message} htmlFor="twelfthYear">
              <Input id="twelfthYear" type="number" min={1990} max={new Date().getFullYear()} {...register("twelfthYear", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Percentage (%)" required error={errors.twelfthPercentage?.message} htmlFor="twelfthPct">
              <Input id="twelfthPct" type="number" step="0.01" min={0} max={100} placeholder="e.g. 88.0" {...register("twelfthPercentage", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Stream" error={errors.twelfthStream?.message} htmlFor="twelfthStream">
              <Select id="twelfthStream" {...register("twelfthStream")}>
                {["Science", "Commerce", "Arts"].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* JEE */}
      <Card>
        <CardHeader><CardTitle className="text-base">Entrance Examination</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="JEE Main Rank" error={errors.jeeMainRank?.message} htmlFor="jeeMain">
              <Input id="jeeMain" type="number" min={1} placeholder="Optional" {...register("jeeMainRank", { valueAsNumber: true })} />
            </FormField>
            <FormField label="JEE Advanced Rank" error={errors.jeeAdvancedRank?.message} htmlFor="jeeAdv">
              <Input id="jeeAdv" type="number" min={1} placeholder="Optional" {...register("jeeAdvancedRank", { valueAsNumber: true })} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Current Academic */}
      <Card>
        <CardHeader><CardTitle className="text-base">Current Academic Performance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Current CGPA" required error={errors.currentCgpa?.message} htmlFor="cgpa" hint="0.00 – 10.00">
              <Input id="cgpa" type="number" step="0.01" min={0} max={10} placeholder="e.g. 8.45" {...register("currentCgpa", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Current Semester" required error={errors.currentSemester?.message} htmlFor="sem">
              <Select id="sem" {...register("currentSemester", { valueAsNumber: true })}>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Total Backlogs" error={errors.totalBacklogs?.message} htmlFor="backlogs">
              <Input id="backlogs" type="number" min={0} {...register("totalBacklogs", { valueAsNumber: true })} />
            </FormField>
          </div>
          <FormField label="Active Backlogs" error={errors.activeBacklogs?.message} htmlFor="activeBacklogs">
            <Input id="activeBacklogs" type="number" min={0} className="max-w-xs" {...register("activeBacklogs", { valueAsNumber: true })} />
          </FormField>
        </CardContent>
      </Card>

      {/* SGPA Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Semester-wise SGPA</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ semester: fields.length + 1, sgpa: undefined as any, backlogs: 0 })}
            >
              <Plus className="h-4 w-4" /> Add Semester
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(errors.sgpaRecords as any)?.root?.message && (
            <p className="text-xs text-destructive">{(errors.sgpaRecords as any).root.message}</p>
          )}
          {(errors.sgpaRecords as any)?.message && (
            <p className="text-xs text-destructive">{(errors.sgpaRecords as any).message}</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-3 rounded-lg border p-3">
              <FormField label="Semester" required error={(errors.sgpaRecords?.[index] as any)?.semester?.message} htmlFor={`sem-${index}`} className="w-28">
                <Select id={`sem-${index}`} {...register(`sgpaRecords.${index}.semester`, { valueAsNumber: true })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>Sem {s}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="SGPA" required error={(errors.sgpaRecords?.[index] as any)?.sgpa?.message} htmlFor={`sgpa-${index}`} className="flex-1">
                <Input
                  id={`sgpa-${index}`}
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  placeholder="e.g. 8.75"
                  {...register(`sgpaRecords.${index}.sgpa`, { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Backlogs" error={(errors.sgpaRecords?.[index] as any)?.backlogs?.message} htmlFor={`bl-${index}`} className="w-24">
                <Input
                  id={`bl-${index}`}
                  type="number"
                  min={0}
                  {...register(`sgpaRecords.${index}.backlogs`, { valueAsNumber: true })}
                />
              </FormField>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 h-10 w-10 text-destructive hover:text-destructive shrink-0"
                  onClick={() => remove(index)}
                  aria-label="Remove semester"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Complete Profile ✓
        </Button>
      </div>
    </form>
  );
}
