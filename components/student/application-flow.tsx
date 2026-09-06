/**
 * Application Flow Component — Phase 3
 * Multi-step application process: Eligibility → Resume → Confirmation → Submit
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { 
  X, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  ArrowRight,
  ArrowLeft,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityResult {
  eligible: boolean;
  results: Array<{
    ruleId: string;
    label: string;
    field: string;
    passed: boolean;
    reason: string;
  }>;
}

interface Resume {
  id: string;
  filename: string;
  fileUrl: string;
  uploadedAt: string;
  isDefault: boolean;
}

interface ApplicationFlowProps {
  opportunityId: string;
  jobRoleId: string;
  eligibility: EligibilityResult;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = "eligibility" | "resume" | "confirmation" | "submitting";

export function ApplicationFlow({
  opportunityId,
  jobRoleId,
  eligibility,
  onSuccess,
  onCancel,
}: ApplicationFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>("eligibility");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch available resumes when reaching resume step
  useEffect(() => {
    if (currentStep === "resume") {
      fetchResumes();
    }
  }, [currentStep]);

  const fetchResumes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/student/resumes");
      if (!response.ok) throw new Error("Failed to fetch resumes");
      
      const data = await response.json();
      setResumes(data.resumes || []);
      
      // Auto-select default resume if available
      const defaultResume = data.resumes?.find((r: Resume) => r.isDefault);
      if (defaultResume) {
        setSelectedResumeId(defaultResume.id);
      }
    } catch (error) {
      console.error("Failed to fetch resumes:", error);
      toast({
        title: "Error",
        description: "Failed to load your resumes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedResumeId) {
      toast({
        title: "Resume Required",
        description: "Please select a resume before submitting your application.",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep("submitting");
    setSubmitting(true);

    try {
      const response = await fetch("/api/student/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobRoleId,
          resumeVersionId: selectedResumeId,
          confirmed: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      onSuccess();
    } catch (error) {
      console.error("Failed to submit application:", error);
      toast({
        title: "Application Failed",
        description: "Failed to submit your application. Please try again.",
        variant: "destructive",
      });
      setCurrentStep("confirmation");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepNumber = (step: Step) => {
    const steps = ["eligibility", "resume", "confirmation", "submitting"];
    return steps.indexOf(step) + 1;
  };

  const canProceedFromEligibility = eligibility.eligible;
  const canProceedFromResume = selectedResumeId !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Apply for Position</h2>
            <p className="text-sm text-muted-foreground">
              Step {getStepNumber(currentStep)} of 3
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center p-4 border-b">
          <div className="flex items-center gap-2">
            {["eligibility", "resume", "confirmation"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2",
                    currentStep === step || getStepNumber(currentStep) > index + 1
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div className={cn(
                    "h-0.5 w-12 mx-2",
                    getStepNumber(currentStep) > index + 1 ? "bg-primary" : "bg-muted-foreground/30"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStep === "eligibility" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Eligibility Check</h3>
                <p className="text-muted-foreground text-sm">
                  Please review your eligibility for this position before proceeding.
                </p>
              </div>

              <Card className={cn(
                "border-2",
                eligibility.eligible 
                  ? "border-green-200 bg-green-50" 
                  : "border-red-200 bg-red-50"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    {eligibility.eligible ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <h4 className={cn(
                        "font-semibold",
                        eligibility.eligible ? "text-green-800" : "text-red-800"
                      )}>
                        {eligibility.eligible ? "You are eligible!" : "Eligibility requirements not met"}
                      </h4>
                      <p className={cn(
                        "text-sm",
                        eligibility.eligible ? "text-green-700" : "text-red-700"
                      )}>
                        {eligibility.eligible 
                          ? "You meet all the requirements for this position."
                          : "Please review the requirements below."
                        }
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {eligibility.results.map((result) => (
                      <div
                        key={result.ruleId}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                      >
                        {result.passed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{result.label}</p>
                          <p className="text-xs text-muted-foreground">{result.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setCurrentStep("resume")}
                  disabled={!canProceedFromEligibility}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "resume" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Resume</h3>
                <p className="text-muted-foreground text-sm">
                  Choose the resume you want to submit with your application.
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : resumes.length === 0 ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                      <div>
                        <h4 className="font-semibold text-amber-800">No Resume Found</h4>
                        <p className="text-sm text-amber-700">
                          You need to upload a resume before applying for positions.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {resumes.map((resume) => (
                    <Card
                      key={resume.id}
                      className={cn(
                        "cursor-pointer transition-colors border-2",
                        selectedResumeId === resume.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setSelectedResumeId(resume.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{resume.filename}</p>
                              {resume.isDefault && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Uploaded on {new Date(resume.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          {selectedResumeId === resume.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("eligibility")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {resumes.length === 0 && (
                    <Button variant="outline" asChild>
                      <a href="/student/resumes" target="_blank">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Resume
                      </a>
                    </Button>
                  )}
                  <Button
                    onClick={() => setCurrentStep("confirmation")}
                    disabled={!canProceedFromResume}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === "confirmation" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Confirm Application</h3>
                <p className="text-muted-foreground text-sm">
                  Please review your application details before submitting.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Selected Resume</p>
                    <p className="font-medium">
                      {resumes.find(r => r.id === selectedResumeId)?.filename}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground">Eligibility Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">All requirements met</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium mb-1">Important Note:</p>
                    <p>
                      By submitting this application, you confirm that all information provided is accurate 
                      and complete. You can track your application status on the My Applications page.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("resume")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSubmitApplication} className="bg-green-600 hover:bg-green-700">
                  Submit Application
                </Button>
              </div>
            </div>
          )}

          {currentStep === "submitting" && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <LoadingSpinner size="lg" className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Submitting Application</h3>
                <p className="text-muted-foreground">
                  Please wait while we process your application...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}