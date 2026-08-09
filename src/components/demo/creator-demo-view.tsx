"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap, BookOpen, Users, DollarSign, BarChart3, Plus, Lock, Eye, Upload, FileText, Layers, Calendar, Clock, Trophy } from "lucide-react";
import type { DemoProfile, DemoCreatorStats, DemoSpace, DemoMaterial, DemoChallenge } from "@/lib/demo-data";

interface CreatorDemoProps {
  profile: DemoProfile;
  stats: DemoCreatorStats;
  spaces: DemoSpace[];
  materials: DemoMaterial[];
  challenges: DemoChallenge[];
}

export function CreatorDemoView({ profile, stats, spaces, materials, challenges }: CreatorDemoProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const handlePublish = () => {
    toast.success("Study set published to 1,200 subscriber feeds!");
  };

  const handleVipGate = () => {
    toast.success("Content gated for VIP subscribers only");
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {profile.display_name.split(" ")[0].charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.display_name}</h2>
                <p className="text-muted-foreground">{profile.bio}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" /> Creator
                  </Badge>
                  <Badge variant="outline">{profile.major}</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{stats.activeFans.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Active Fan Learners</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BookOpen className="h-4 w-4" />
              Published Decks
            </div>
            <div className="text-2xl font-bold">{stats.publishedDecks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              Active Challenges
            </div>
            <div className="text-2xl font-bold">{stats.activeChallenges}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              Quiz Completion
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.avgQuizCompletion}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Revenue
            </div>
            <div className="text-2xl font-bold">${stats.monthlyRevenue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Impact Dashboard Card */}
      <Card className="border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Creator Impact Dashboard
          </CardTitle>
          <CardDescription>
            Data-Backed Analytics: 4x higher completion rates vs. traditional study apps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.activeFans.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Active Fan Learners</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.avgQuizCompletion}%</div>
              <div className="text-sm text-muted-foreground">
                Average Quiz Completion Rate
                <div className="text-xs">(vs. 22% Industry Standard)</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.weeklyEngagementHours}h</div>
              <div className="text-sm text-muted-foreground">Weekly Active Engagement Per Fan</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="spaces">My Spaces</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Deck Generator with Subscriber Gating</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Upload lecture notes/PDFs</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically split into flashcards
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Public Teaser Cards (Free for all fans)</span>
                  </div>
                  <Badge variant="secondary">Free</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>VIP Subscriber Cards (Gated for supporters/members)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                      🔒 VIP
                    </Badge>
                    <Button size="sm" onClick={handleVipGate}>
                      Gate Content
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-700 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Vector Caching Efficiency Badge
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Served via Vector Cache (0ms latency | 0 LLM API Cost)
                </p>
              </div>
              <Button onClick={handlePublish} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Publish Study Set
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Creator Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                    SC
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Prof. Sarah Chen</p>
                    <p className="text-sm">
                      Just dropped: &apos;Rotational Dynamics&apos; flashcard set (VIP). 32 cards covering torque, angular momentum...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                    SC
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Prof. Sarah Chen</p>
                    <p className="text-sm">Quick poll: Which topic needs a live review session this Friday?</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span>📊 Rotational Kinematics (34 votes)</span>
                      <span>📊 Angular Momentum (52 votes)</span>
                      <span>📊 Rolling Motion (18 votes)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-4 space-y-4">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {m.type === "flashcard_set" && <Layers className="h-4 w-4" />}
                      {m.type === "note" && <FileText className="h-4 w-4" />}
                      {m.type === "link" && <Upload className="h-4 w-4" />}
                      {m.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {m.description}
                    </CardDescription>
                  </div>
                  {m.metadata?.is_vip && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                      🔒 VIP
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Vector Cache
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {m.community_score} upvotes
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {m.metadata?.cards || 0} cards
                    </span>
                  </div>
                  <Button size="sm" variant="outline">
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="challenges" className="mt-4 space-y-4">
          {challenges.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <CardDescription className="text-sm">{c.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Trophy className="h-3 w-3" /> {c.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{c.participants.toLocaleString()} participants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>+{c.xp_reward} XP</span>
                  </div>
                  <div className="text-muted-foreground">
                    Expires: {new Date(c.expires_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="spaces" className="mt-4 space-y-4">
          {spaces.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {s.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{s.semester} {s.year || "2025"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{s.meeting_schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Room: {s.room}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
