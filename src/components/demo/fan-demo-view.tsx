"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Zap, Flame, Award, BookOpen, Calendar, Clock, Trophy, Users, MessageSquare, Check, X, Lightbulb, Share2, TrendingUp, Layers, FileText, Upload } from "lucide-react";

interface FanDemoProps {
  profile: any;
  stats: any;
  spaces: any[];
  materials: any[];
  challenges: any[];
  leaderboard: any[];
  activityFeed: any[];
  quizQuestions: any[];
}

export function FanDemoView({ profile, stats, spaces, materials, challenges, leaderboard, activityFeed, quizQuestions }: FanDemoProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const currentQuestion = quizQuestions[currentQuizIndex];

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    if (index === currentQuestion.correct) {
      toast.success("Correct! +10 Creator Loyalty Points");
    } else {
      toast.error("Incorrect, try again!");
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      setQuizComplete(true);
    }
  };

  const handleShareScore = () => {
    toast.success("Score shared on Creator's Community Feed!");
    setQuizComplete(false);
    setCurrentQuizIndex(0);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xl">
                {profile.display_name.split(" ")[0].charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.display_name}</h2>
                <p className="text-muted-foreground">{profile.bio}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="h-3 w-3" /> {profile.major}
                  </Badge>
                  <Badge variant="outline">GPA: {profile.gpa}</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">⚡ {stats.fanXP.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Fan XP</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Fan Loyalty Header Widget */}
      <Card className="border-2 border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Fan Loyalty & Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <span className="text-2xl font-bold">{stats.studyStreak}</span>
              </div>
              <p className="text-sm text-muted-foreground">Day Study Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Award className="h-6 w-6 text-amber-500" />
                <span className="text-2xl font-bold">{stats.tier}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stats.tierRank}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Zap className="h-6 w-6 text-blue-500" />
                <span className="text-2xl font-bold">{stats.fanXP.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground">Fan XP</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BookOpen className="h-4 w-4" />
              Quizzes Completed
            </div>
            <div className="text-2xl font-bold">{stats.quizzesCompleted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              Badges Earned
            </div>
            <div className="text-2xl font-bold">{stats.badgesEarned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Avg Score
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feed">Creator Activity Feed</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="quiz">Challenge Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrolled in Creator Cohorts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {spaces.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">{s.instructor}</p>
                    </div>
                    <Badge variant="outline">{s.semester}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Study Materials from Creators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {materials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {m.type === "flashcard_set" && <Layers className="h-4 w-4" />}
                        {m.type === "note" && <FileText className="h-4 w-4" />}
                        {m.type === "link" && <Upload className="h-4 w-4" />}
                        {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    {m.metadata?.is_vip ? (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                        🔒 VIP
                      </Badge>
                    ) : (
                      <Badge variant="outline">Free</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Challenges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {challenges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      +{c.xp_reward} XP
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feed" className="mt-4 space-y-4">
          {activityFeed.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    SC
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Prof. Sarah Chen</span>
                      <Badge variant="secondary" className="text-xs">Creator</Badge>
                    </div>
                    <p className="text-sm">{a.content}</p>
                    {a.type === "poll" && a.options && (
                      <div className="flex gap-4 mt-2 text-xs">
                        {a.options.map((option: string, i: number) => (
                          <span key={i} className="flex items-center gap-1">
                            📊 {option} ({a.votes?.[i] || 0} votes)
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{a.timestamp}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Creator Hub Leaderboard
              </CardTitle>
              <CardDescription>
                Top 5 students in Prof. Sarah Chen&apos;s cohort
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3 pr-4">Rank</th>
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Weekly Score</th>
                      <th className="pb-3 pr-4">Streak</th>
                      <th className="pb-3">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr
                        key={entry.rank}
                        className="border-t text-sm"
                      >
                        <td className="py-3 pr-4">
                          <Badge variant={entry.rank === 1 ? "default" : "secondary"} className="h-6 w-6 flex items-center justify-center p-0">
                            {entry.rank}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-medium">{entry.name}</td>
                        <td className="py-3 pr-4">{entry.weeklyScore}%</td>
                         <td className="py-3 pr-4">
                           <span className="flex items-center gap-1">
                             <Flame className="h-3 w-3 text-orange-500" />
                             {entry.streak}
                           </span>
                         </td>
                        <td className="py-3">{entry.xp.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Interactive Challenge Quiz
              </CardTitle>
              <CardDescription>
                Multiple-choice format with instant validation and creator explanations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!quizComplete ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">
                        Question {currentQuizIndex + 1} of {quizQuestions.length}
                      </h3>
                      <p className="text-lg font-semibold mb-4">{currentQuestion.question}</p>
                      
                      <div className="grid gap-3">
                        {currentQuestion.options.map((option: string, index: number) => {
                          const isCorrect = index === currentQuestion.correct;
                          const isSelected = selectedAnswer === index;
                          const showFeedback = selectedAnswer !== null;
                          
                          return (
                            <button
                              key={index}
                              onClick={() => handleAnswerSelect(index)}
                              disabled={selectedAnswer !== null}
                              className={`w-full text-left rounded-lg border p-4 text-sm transition-all ${
                                showFeedback
                                  ? isCorrect
                                    ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-300"
                                    : isSelected
                                    ? "bg-red-500/10 border-red-500 text-red-700 dark:text-red-300"
                                    : ""
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium">
                                  {String.fromCharCode(65 + index)}. {option}
                                </span>
                                {showFeedback && isCorrect && (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                                {showFeedback && isSelected && !isCorrect && (
                                  <X className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Explanation Drawer */}
                    {showExplanation && (
                      <div className="rounded-lg border bg-card/50 p-4 animate-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium mb-2">Creator Explanation:</p>
                            <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleNextQuestion}
                      disabled={selectedAnswer === null}
                      className="w-full"
                    >
                      {currentQuizIndex < quizQuestions.length - 1 ? "Next Question" : "View Results"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/10 text-green-700 mb-4">
                    <Trophy className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Quiz Complete! 🎉</h3>
                  <p className="text-lg font-semibold text-primary">Score: 90%</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    +100 Fan XP Earned
                  </p>
                  <div className="space-y-3">
                    <Button onClick={handleShareScore} className="w-full">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Score on Community Feed
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setQuizComplete(false);
                      setCurrentQuizIndex(0);
                      setSelectedAnswer(null);
                      setShowExplanation(false);
                    }} className="w-full">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
