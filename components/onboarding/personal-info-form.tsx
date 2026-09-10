"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalInfoSchema, type PersonalInfoInput } from "@/lib/validations/student";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";

interface Props {
  defaultValues?: any;
  onSuccess: () => void;
  /** Phase 12 — "Save & Continue →" reads oddly once this form is reused
   *  post-onboarding (personal-academic-profile.tsx); override it there. */
  submitLabel?: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli","Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

export function PersonalInfoForm({ defaultValues, onSuccess, submitLabel }: Props) {
  const [error, setError] = useState("");
  const [sameAddress, setSameAddress] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema) as any,
    defaultValues: {
      firstName: defaultValues?.firstName ?? "",
      middleName: defaultValues?.middleName ?? "",
      lastName: defaultValues?.lastName ?? "",
      dateOfBirth: defaultValues?.dateOfBirth
        ? new Date(defaultValues.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: defaultValues?.gender ?? "MALE",
      category: defaultValues?.category ?? "GENERAL",
      religion: defaultValues?.religion ?? "",
      nationality: defaultValues?.nationality ?? "Indian",
      motherTongue: defaultValues?.motherTongue ?? "",
      aadharNumber: defaultValues?.aadharNumber ?? "",
      personalEmail: defaultValues?.personalEmail ?? "",
      phoneNumber: defaultValues?.phoneNumber ?? "",
      alternatePhone: defaultValues?.alternatePhone ?? "",
      currentAddress: defaultValues?.currentAddress ?? "",
      currentCity: defaultValues?.currentCity ?? "",
      currentState: defaultValues?.currentState ?? "",
      currentPincode: defaultValues?.currentPincode ?? "",
      permanentAddress: defaultValues?.permanentAddress ?? "",
      permanentCity: defaultValues?.permanentCity ?? "",
      permanentState: defaultValues?.permanentState ?? "",
      permanentPincode: defaultValues?.permanentPincode ?? "",
      fatherName: defaultValues?.fatherName ?? "",
      fatherOccupation: defaultValues?.fatherOccupation ?? "",
      fatherPhone: defaultValues?.fatherPhone ?? "",
      motherName: defaultValues?.motherName ?? "",
      motherOccupation: defaultValues?.motherOccupation ?? "",
      motherPhone: defaultValues?.motherPhone ?? "",
      annualFamilyIncome: defaultValues?.annualFamilyIncome ?? undefined,
      bloodGroup: defaultValues?.bloodGroup ?? "",
      passportNumber: defaultValues?.passportNumber ?? "",
    },
  });

  async function onSubmit(data: PersonalInfoInput) {
    setError("");
    try {
      const res = await fetch("/api/students/onboarding/personal", {
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

  function handleSameAddress() {
    const current = watch(["currentAddress", "currentCity", "currentState", "currentPincode"]);
    if (!sameAddress) {
      setValue("permanentAddress", current[0]);
      setValue("permanentCity", current[1]);
      setValue("permanentState", current[2]);
      setValue("permanentPincode", current[3]);
    }
    setSameAddress(!sameAddress);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="First Name" required error={errors.firstName?.message} htmlFor="firstName">
              <Input id="firstName" placeholder="Arjun" {...register("firstName")} />
            </FormField>
            <FormField label="Middle Name" error={errors.middleName?.message} htmlFor="middleName">
              <Input id="middleName" placeholder="Kumar" {...register("middleName")} />
            </FormField>
            <FormField label="Last Name" required error={errors.lastName?.message} htmlFor="lastName">
              <Input id="lastName" placeholder="Sharma" {...register("lastName")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Date of Birth" required error={errors.dateOfBirth?.message} htmlFor="dob">
              <Input id="dob" type="date" {...register("dateOfBirth")} />
            </FormField>
            <FormField label="Gender" required error={errors.gender?.message} htmlFor="gender">
              <Select id="gender" {...register("gender")}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </Select>
            </FormField>
            <FormField label="Category" required error={errors.category?.message} htmlFor="category">
              <Select id="category" {...register("category")}>
                <option value="GENERAL">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
                <option value="PWD">PWD</option>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Nationality" required error={errors.nationality?.message} htmlFor="nationality">
              <Input id="nationality" {...register("nationality")} />
            </FormField>
            <FormField label="Religion" error={errors.religion?.message} htmlFor="religion">
              <Input id="religion" placeholder="Optional" {...register("religion")} />
            </FormField>
            <FormField label="Mother Tongue" error={errors.motherTongue?.message} htmlFor="motherTongue">
              <Input id="motherTongue" placeholder="e.g. Malayalam" {...register("motherTongue")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Aadhar Number" error={errors.aadharNumber?.message} htmlFor="aadhar" hint="12-digit Aadhar number">
              <Input id="aadhar" placeholder="XXXX XXXX XXXX" maxLength={12} {...register("aadharNumber")} />
            </FormField>
            <FormField label="Blood Group" error={errors.bloodGroup?.message} htmlFor="bloodGroup">
              <Select id="bloodGroup" {...register("bloodGroup")}>
                <option value="">Select...</option>
                {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Mobile Number" required error={errors.phoneNumber?.message} htmlFor="phone">
              <Input id="phone" placeholder="9XXXXXXXXX" maxLength={10} {...register("phoneNumber")} />
            </FormField>
            <FormField label="Alternate Mobile" error={errors.alternatePhone?.message} htmlFor="altPhone">
              <Input id="altPhone" placeholder="Optional" maxLength={10} {...register("alternatePhone")} />
            </FormField>
          </div>
          <FormField label="Personal Email" error={errors.personalEmail?.message} htmlFor="personalEmail">
            <Input id="personalEmail" type="email" placeholder="you@example.com" {...register("personalEmail")} />
          </FormField>
        </CardContent>
      </Card>

      {/* Current Address */}
      <Card>
        <CardHeader><CardTitle className="text-base">Current Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Address" required error={errors.currentAddress?.message} htmlFor="curAddr">
            <Input id="curAddr" placeholder="House / Flat, Street, Area" {...register("currentAddress")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="City" required error={errors.currentCity?.message} htmlFor="curCity">
              <Input id="curCity" placeholder="City" {...register("currentCity")} />
            </FormField>
            <FormField label="State" required error={errors.currentState?.message} htmlFor="curState">
              <Select id="curState" {...register("currentState")}>
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Pincode" required error={errors.currentPincode?.message} htmlFor="curPin">
              <Input id="curPin" placeholder="6-digit" maxLength={6} {...register("currentPincode")} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Permanent Address */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Permanent Address</CardTitle>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sameAddress}
                onChange={handleSameAddress}
                className="rounded"
              />
              Same as current
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Address" error={errors.permanentAddress?.message} htmlFor="permAddr">
            <Input id="permAddr" placeholder="House / Flat, Street, Area" {...register("permanentAddress")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="City" error={errors.permanentCity?.message} htmlFor="permCity">
              <Input id="permCity" placeholder="City" {...register("permanentCity")} />
            </FormField>
            <FormField label="State" error={errors.permanentState?.message} htmlFor="permState">
              <Select id="permState" {...register("permanentState")}>
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Pincode" error={errors.permanentPincode?.message} htmlFor="permPin">
              <Input id="permPin" placeholder="6-digit" maxLength={6} {...register("permanentPincode")} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Family Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Family Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Father's Name" required error={errors.fatherName?.message} htmlFor="fatherName">
              <Input id="fatherName" placeholder="Full name" {...register("fatherName")} />
            </FormField>
            <FormField label="Father's Occupation" error={errors.fatherOccupation?.message} htmlFor="fatherOcc">
              <Input id="fatherOcc" placeholder="e.g. Engineer" {...register("fatherOccupation")} />
            </FormField>
            <FormField label="Father's Mobile" error={errors.fatherPhone?.message} htmlFor="fatherPhone">
              <Input id="fatherPhone" placeholder="10-digit" maxLength={10} {...register("fatherPhone")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Mother's Name" required error={errors.motherName?.message} htmlFor="motherName">
              <Input id="motherName" placeholder="Full name" {...register("motherName")} />
            </FormField>
            <FormField label="Mother's Occupation" error={errors.motherOccupation?.message} htmlFor="motherOcc">
              <Input id="motherOcc" placeholder="e.g. Teacher" {...register("motherOccupation")} />
            </FormField>
            <FormField label="Mother's Mobile" error={errors.motherPhone?.message} htmlFor="motherPhone">
              <Input id="motherPhone" placeholder="10-digit" maxLength={10} {...register("motherPhone")} />
            </FormField>
          </div>
          <FormField label="Annual Family Income (₹)" error={errors.annualFamilyIncome?.message} htmlFor="income">
            <Input id="income" type="number" min={0} placeholder="e.g. 600000" {...register("annualFamilyIncome", { valueAsNumber: true })} />
          </FormField>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {submitLabel ?? "Save & Continue →"}
        </Button>
      </div>
    </form>
  );
}
