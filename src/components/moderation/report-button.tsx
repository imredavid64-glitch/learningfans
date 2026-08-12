"use client";

import { useState } from "react";
import { submitReportFromForm } from "@/actions/moderation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";

export function ReportButton({
  targetType,
  targetId,
  compact,
  className,
}: {
  targetType: string;
  targetId: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("targetType", targetType);
    formData.set("targetId", targetId);
    await submitReportFromForm(formData);
    setDone(true);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          compact ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              title="Report this message"
              className={cn("h-6 w-6", className)}
            >
              <Flag className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm">Report</Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-muted-foreground">Report submitted. Thank you.</p>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" required rows={3} />
            </div>
            <Button type="submit">Submit report</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
