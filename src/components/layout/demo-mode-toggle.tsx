"use client";

import { Button } from "@/components/ui/button";
import { Zap, Users, Brain } from "lucide-react";
import { useDemoMode } from "@/lib/demo-mode";

export function DemoModeToggle() {
  const { demoMode, setDemoMode, isDemoMode } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <>
      {/* Judge Guidance Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-center text-white text-sm font-medium animate-pulse">
        🎯 LearningFans Dual-Mode Active: Toggle between Creator Studio and Student Fan Feed to test the full ecosystem
      </div>
      
      {/* Demo Mode Toggle */}
      <div className="flex items-center gap-2 ml-4">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <Button
            variant={demoMode === "off" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDemoMode("off")}
            className="h-8 px-3"
          >
            <Brain className="h-3.5 w-3.5 mr-1" /> Live
          </Button>
          <Button
            variant={demoMode === "creator" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDemoMode("creator")}
            className="h-8 px-3"
          >
            <Zap className="h-3.5 w-3.5 mr-1" /> Creator
          </Button>
          <Button
            variant={demoMode === "fan" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDemoMode("fan")}
            className="h-8 px-3"
          >
            <Users className="h-3.5 w-3.5 mr-1" /> Fan
          </Button>
        </div>
      </div>
    </>
  );
}
