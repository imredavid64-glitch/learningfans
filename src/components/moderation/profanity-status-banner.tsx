"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertCircle, Mail, UserCheck, XCircle, CheckCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface ProfanityStatus {
  warnings: number;
  violations: number;
  restrictionLevel: "none" | "warning" | "restricted" | "suspended";
  lastIncidentAt: string | null;
  parentEmail: string | null;
  principalEmail: string | null;
  schoolName: string | null;
}

function getToastMessage(status: ProfanityStatus): string | null {
  if (status.restrictionLevel === "suspended") {
    return `⚠️ Account Suspended: Your account has been suspended due to repeated profanity violations. Parent and principal have been notified.`;
  }
  if (status.restrictionLevel === "restricted") {
    return `⚠️ Account Restricted: Your account is in read-only mode due to profanity violations. Please add parent email for notification.`;
  }
  if (status.restrictionLevel === "warning" && status.warnings > 0) {
    return `⚠️ Content Warning: You have ${status.warnings} warning(s). Next violation will restrict your account.`;
  }
  return null;
}

export function ProfanityStatusBanner() {
  const [status, setStatus] = useState<ProfanityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    // Show toast when status changes and it's not none
    if (status && status.restrictionLevel !== "none" && !dismissed) {
      const message = getToastMessage(status);
      if (message) {
        toast.warning(message, {
          duration: 8000,
          action: {
            label: "View Details",
            onClick: () => setDismissed(false),
          },
        });
      }
    }
  }, [status, dismissed]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/profanity/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch profanity status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveEmails(parentEmail: string, principalEmail: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/profanity/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentEmail, principalEmail }),
      });
      if (res.ok) {
        toast.success("Contact emails saved");
        await fetchStatus();
      } else {
        toast.error("Failed to save emails");
      }
    } catch {
      toast.error("Failed to save emails");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !status) return null;

  if (status.restrictionLevel === "none" || dismissed) return null;

  const getStatusConfig = () => {
    switch (status.restrictionLevel) {
      case "warning":
        return {
          icon: AlertCircle,
          color: "amber",
          title: "Content Warning Issued",
          description: "Profanity detected in your recent content. Please keep discussions respectful.",
          actionText: "You have 1 warning. Next violation will restrict your account.",
          showEmails: false,
        };
      case "restricted":
        return {
          icon: Shield,
          color: "orange",
          title: "Account Restricted",
          description: "Your account has been restricted to read-only mode due to repeated profanity violations.",
          actionText: "You can view content but cannot post, create materials, or join meetings. 7 days of clean behavior will restore access.",
          showEmails: true,
          emailSent: status.parentEmail ? "Parent notified" : "Parent email needed",
        };
      case "suspended":
        return {
          icon: XCircle,
          color: "destructive",
          title: "Account Suspended",
          description: "Your account has been suspended due to severe repeated profanity violations.",
          actionText: "All LearningFans features are disabled. Parent and principal have been notified. Contact support for appeal.",
          showEmails: true,
          emailSent: "Notifications sent",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;
  const showEmailForm = config.showEmails && !status.parentEmail;

  return (
    <Card className={`border-${config.color}-500/50 bg-${config.color}-500/5 animate-in slide-in-from-top-2`}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 p-2 rounded-lg bg-${config.color}-500/10`}>
            <Icon className={`h-5 w-5 text-${config.color}-600`} />
          </div>
         <div className="flex-1 min-w-0">
             <CardTitle className={`text-${config.color}-700 dark:text-${config.color}-300`}>
               {config.title}
             </CardTitle>
             <CardDescription className="mt-1">{config.description}</CardDescription>
           </div>
           <div className="flex items-center gap-2">
             <Badge variant="secondary" className={`bg-${config.color}-500/10 text-${config.color}-700 dark:text-${config.color}-300 border-${config.color}-500/20`}>
               {status.violations} violation(s)
             </Badge>
             <Button
               variant="ghost"
               size="icon"
               onClick={() => setDismissed(true)}
               className="h-6 w-6"
               aria-label="Dismiss"
             >
               <X className="h-3 w-3" />
             </Button>
           </div>
         </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={config.color === "destructive" ? "destructive" : "default"} className={`border-${config.color}-200`}>
          <AlertDescription className="flex items-start gap-2">
            <Info className={`h-4 w-4 text-${config.color}-600 flex-shrink-0 mt-0.5`} />
            <div>
              <p className="font-medium">{config.actionText}</p>
              {status.lastIncidentAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last incident: {new Date(status.lastIncidentAt).toLocaleString()}
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {showEmailForm && (
          <div className="space-y-3 p-4 rounded-lg bg-background border">
            <h4 className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Add Contact Emails for Notifications
            </h4>
            <p className="text-sm text-muted-foreground">
              Provide parent/guardian and principal emails so they receive automated notifications about account status changes.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="parentEmail">Parent/Guardian Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  placeholder="parent@example.com"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="principalEmail">Principal/School Admin Email</Label>
                <Input
                  id="principalEmail"
                  type="email"
                  placeholder="principal@school.edu"
                  disabled={saving}
                />
              </div>
            </div>
            <Button 
              onClick={() => {
                const parentEmail = (document.getElementById("parentEmail") as HTMLInputElement)?.value;
                const principalEmail = (document.getElementById("principalEmail") as HTMLInputElement)?.value;
                if (parentEmail || principalEmail) {
                  saveEmails(parentEmail, principalEmail);
                }
              }}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Emails
            </Button>
          </div>
        )}

        {config.showEmails && status.parentEmail && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>Parent notified: {status.parentEmail}</span>
          </div>
        )}

        {config.showEmails && status.principalEmail && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <UserCheck className="h-4 w-4" />
            <span>Principal notified: {status.principalEmail}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}