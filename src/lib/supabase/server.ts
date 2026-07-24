import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { containsProfanity, containsSpam } from "@/lib/profanity";
import { shouldArchive, archiveOldData } from "@/lib/archive";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from Server Component; middleware will refresh session.
          }
        },
      },
    },
  );
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export async function checkContentWithAI(content: string, context?: string): Promise<{
  is_clean: boolean;
  risk_level: "none" | "low" | "medium" | "high";
  violations: string[];
  suggested_action?: "allow" | "warn" | "strike" | "ban";
}> {
  // Local profanity pre-check (fast, no API call)
  const profanity = containsProfanity(content);
  if (!profanity.clean) {
    return {
      is_clean: false,
      risk_level: "high",
      violations: profanity.words,
      suggested_action: "strike",
    };
  }

  // Local spam pre-check
  const spam = containsSpam(content);
  if (spam.isSpam) {
    return {
      is_clean: false,
      risk_level: "medium",
      violations: ["spam"],
      suggested_action: "warn",
    };
  }

  // Groq AI moderation (second pass for nuanced content)
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI for an educational platform. Check text for:
            1. Profanity/slurs
            2. Hate speech/discrimination  
            3. Violence/threats
            4. Spam/repetitive patterns
            5. Inappropriate academic content
            
            Return JSON with:
            - is_clean: boolean (false if violations present)
            - risk_level: "none"|"low"|"medium"|"high" (severity)
            - violations: array of violation types
            - suggested_action: "allow"|"warn"|"strike"|"ban"
            
            Violation types: "profanity", "hate", "violence", "spam", "inappropriate_academic", "other"
            
            Context: ${context || "general academic discussion"}`,
          },
          {
            role: "user",
            content: `Check this content: "${content}"`,
          },
        ],
        temperature: 0,
      }),
    });

    const data = await response.json();
    const content_text = data.choices[0].message.content;
    
    try {
      return JSON.parse(content_text);
    } catch {
      console.error("Failed to parse AI moderation response:", content_text);
    }
  } catch (error) {
    console.error("Groq API error:", error);
  }
  
  return {
    is_clean: true,
    risk_level: "low",
    violations: [],
    suggested_action: "allow",
  };
}

export async function checkAndArchive(): Promise<{ archived: number; deleted: number } | null> {
  try {
    const needsArchive = await shouldArchive();
    if (needsArchive) {
      return await archiveOldData();
    }
    return null;
  } catch {
    return null;
  }
}

export async function moderatePost(postId: string): Promise<{ status: "approved" | "flagged" | "rejected" }> {
  const supabase = await createClient();
  
  const { data: post } = await supabase
    .from("posts")
    .select("* ")
    .eq("id", postId)
    .single();
    
  if (!post) throw new Error("Post not found");
  
  const moderation = await checkContentWithAI(post.body, "discussion post");
  
  if (moderation.is_clean || moderation.risk_level === "low") {
    return { status: "approved" };
  }
  
  if (moderation.risk_level === "high") {
    // Auto-ban user
    await supabase.from("user_sanctions").insert({
      user_id: post.author_id,
      type: "suspend",
      reason: `AI moderation: ${moderation.violations.join(", ")}`
    });
    return { status: "rejected" };
  }
  
  return { status: "flagged" };
}