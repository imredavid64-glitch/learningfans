"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Users, Brain, ArrowLeft, Award, Calendar, TrendingUp } from "lucide-react";
import { DEMO_CREATOR_PROFILE, DEMO_CREATOR_STATS, DEMO_FAN_PROFILE, DEMO_FAN_STATS, DEMO_SPACES, DEMO_MATERIALS, DEMO_CHALLENGES, DEMO_LEADERBOARD, DEMO_ACTIVITY_FEED, DEMO_QUIZ_QUESTIONS } from "@/lib/demo-data";
import { CreatorDemoView } from "@/components/demo/creator-demo-view";
import { FanDemoView } from "@/components/demo/fan-demo-view";

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState("creator");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Demo Mode</h1>
          <p className="text-muted-foreground">Experience both sides of LearningFans</p>
        </div>
      </div>

      {/* Judge Guidance Banner */}
      <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5" />
              <div>
                <p className="font-semibold">LearningFans Dual-Mode Active</p>
                <p className="text-sm text-white/80">
                  Toggle between Creator Studio and Student Fan Feed to test the full ecosystem
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white">
              Judge Preview Mode
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Mode Toggle */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="creator" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Creator Studio
          </TabsTrigger>
          <TabsTrigger value="fan" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fan Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="creator" className="mt-4">
          <CreatorDemoView
            profile={DEMO_CREATOR_PROFILE}
            stats={DEMO_CREATOR_STATS}
            spaces={DEMO_SPACES}
            materials={DEMO_MATERIALS}
            challenges={DEMO_CHALLENGES}
          />
        </TabsContent>

        <TabsContent value="fan" className="mt-4">
          <FanDemoView
            profile={DEMO_FAN_PROFILE}
            stats={DEMO_FAN_STATS}
            spaces={DEMO_SPACES}
            materials={DEMO_MATERIALS}
            challenges={DEMO_CHALLENGES}
            leaderboard={DEMO_LEADERBOARD}
            activityFeed={DEMO_ACTIVITY_FEED}
            quizQuestions={DEMO_QUIZ_QUESTIONS}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Creator Impact Dashboard</p>
                <p className="text-xs text-muted-foreground">
                  1,240 Active Fans · 88% Completion Rate
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Visual Schedule Calendar</p>
                <p className="text-xs text-muted-foreground">
                  Month/Week/List Views · RSVP System
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
