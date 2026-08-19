"use client";

import React from "react";
import { Users, Radio, MessageSquare, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SocialHubWidget() {
  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Social Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" /> Live Audio Huddle
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs">Join</Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> Recent DMs
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs">Open</Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Active Peers
          </div>
          <Badge variant="secondary" className="text-[10px] h-5">4 online</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function Badge({ children, className }: { variant?: string, children: React.ReactNode, className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>;
}
