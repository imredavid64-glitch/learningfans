"use client";

import React, { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export interface DirectMessage {
  id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export function DirectMessageDrawer({
  peerName,
  peerAvatar,
}: {
  currentUserId?: string;
  peerId?: string;
  peerName: string;
  peerAvatar?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMsg: DirectMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender_name: "You",
      body: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setText("");
    toast.success(`Message sent to ${peerName}`);
  };

  const initials = peerName.charAt(0).toUpperCase();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-3.5 w-3.5 text-primary" /> Message
      </Button>

      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2.5 bg-muted/40">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border">
                {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm truncate">{peerName}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-64 overflow-y-auto p-3 space-y-3 bg-background/50">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 opacity-40" />
                No messages with {peerName} yet. Say hello!
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_name === "You";
                return (
                  <div
                    key={m.id}
                    className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-1.5 border-t p-2 bg-card">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${peerName}...`}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" className="h-8 px-3">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
