import { z } from "zod";

export const enrollmentNumberSchema = z
  .string()
  .regex(/^IIST\d{4}[A-Z0-9]{4}$/i, "Format: IIST{YEAR}{4-char code} e.g. IIST2021CS01");

export const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1, "Last name is required").max(50),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  category: z.enum(["GENERAL", "OBC", "SC", "ST", "EWS", "PWD"]),
  religion: z.string().max(50).optional(),
  nationality: z.string().default("Indian"),
  motherTongue: z.string().max(50).optional(),
  aadharNumber: z
    .string()
    .regex(/^\d{12}$/, "Aadhar number must be 12 digits")
    .optional()
    .or(z.literal("")),
  personalEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phoneNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  alternatePhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit number")
    .optional()
    .or(z.literal("")),
  currentAddress: z.string().min(1, "Address is required").max(300),
  currentCity: z.string().min(1, "City is required").max(100),
  currentState: z.string().min(1, "State is required").max(100),
  currentPincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  permanentAddress: z.string().max(300).optional(),
  permanentCity: z.string().max(100).optional(),
  permanentState: z.string().max(100).optional(),
  permanentPincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a valid 6-digit pincode")
    .optional()
    .or(z.literal("")),
  fatherName: z.string().min(1, "Father's name is required").max(100),
  fatherOccupation: z.string().max(100).optional(),
  fatherPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit number")
    .optional()
    .or(z.literal("")),
  motherName: z.string().min(1, "Mother's name is required").max(100),
  motherOccupation: z.string().max(100).optional(),
  motherPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit number")
    .optional()
    .or(z.literal("")),
  annualFamilyIncome: z.coerce.number().min(0).optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
    .optional(),
  passportNumber: z.string().max(20).optional(),
});

const sgpaRecordSchema = z.object({
  semester: z.coerce.number().int().min(1).max(12),
  sgpa: z.coerce.number().min(0).max(10),
  backlogs: z.coerce.number().int().min(0).default(0),
});

export const academicInfoSchema = z.object({
  tenthSchool: z.string().min(1, "School name is required").max(200),
  tenthBoard: z.string().min(1, "Board is required").max(100),
  tenthYear: z.coerce.number().int().min(1990).max(new Date().getFullYear()),
  tenthPercentage: z.coerce
    .number()
    .min(0, "Must be 0–100")
    .max(100, "Must be 0–100"),
  twelfthSchool: z.string().min(1, "School name is required").max(200),
  twelfthBoard: z.string().min(1, "Board is required").max(100),
  twelfthYear: z.coerce.number().int().min(1990).max(new Date().getFullYear()),
  twelfthPercentage: z.coerce
    .number()
    .min(0, "Must be 0–100")
    .max(100, "Must be 0–100"),
  twelfthStream: z.string().max(50).optional(),
  diplomaInstitute: z.string().max(200).optional(),
  diplomaBranch: z.string().max(100).optional(),
  diplomaYear: z.coerce.number().int().min(1990).max(new Date().getFullYear()).optional(),
  diplomaPercentage: z.coerce.number().min(0).max(100).optional(),
  currentCgpa: z.coerce
    .number()
    .min(0, "Must be 0–10")
    .max(10, "Must be 0–10"),
  currentSemester: z.coerce.number().int().min(1).max(12),
  totalBacklogs: z.coerce.number().int().min(0).default(0),
  activeBacklogs: z.coerce.number().int().min(0).default(0),
  jeeMainRank: z.coerce.number().int().min(1).optional(),
  jeeAdvancedRank: z.coerce.number().int().min(1).optional(),
  sgpaRecords: z.array(sgpaRecordSchema).min(1, "Add at least one semester SGPA"),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;
export type AcademicInfoInput = z.infer<typeof academicInfoSchema>;
