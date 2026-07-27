import { createClass } from "@/actions/classes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create a Class</CardTitle>
          <CardDescription>
            Set up a new study group. You can protect it with a password to control who joins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createClass} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class name</Label>
                <Input id="name" name="name" required placeholder="e.g. Calculus II" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <Input id="slug" name="slug" required placeholder="calculus-ii" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" rows={3} placeholder="Course description, topics covered..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classCode">Class code (optional)</Label>
                <Input id="classCode" name="classCode" placeholder="MATH 201" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semester (optional)</Label>
                <Input id="semester" name="semester" placeholder="Fall 2026" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor (optional)</Label>
                <Input id="instructor" name="instructor" placeholder="Prof. Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Input id="department" name="department" placeholder="Mathematics" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="joinPassword" className="font-medium">Password protection (optional)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Set a password to restrict who can join this class. Only people with the password can enroll.
              </p>
              <Input
                id="joinPassword"
                name="joinPassword"
                type="password"
                placeholder="Leave blank for open enrollment"
              />
            </div>

            <Button type="submit" className="w-full">Create class</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
