"use client";

import { useState } from "react";
import { createReport } from "@/actions/moderation";
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

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("targetType", targetType);
    formData.set("targetId", targetId);
    await createReport(formData);
    setDone(true);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm">Report</Button>}
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
