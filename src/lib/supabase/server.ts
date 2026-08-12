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

export interface ProfanityCheckResult {
  isClean: boolean;
  riskLevel: "none" | "low" | "medium" | "high";
  violations: string[];
  suggestedAction: "allow" | "warn" | "restrict" | "suspend";
  escalationTier: "none" | "warning" | "restriction" | "suspension";
}

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
            6. Promotional / advertising / monetized content (selling products or services, affiliate links, self-promotion that adds no educational value)
            
            Content must be educational and on-topic for a learning community. Return JSON with:
            - is_clean: boolean (false if violations present)
            - risk_level: "none"|"low"|"medium"|"high" (severity)
            - violations: array of violation types
            - suggested_action: "allow"|"warn"|"strike"|"ban"
            
            Violation types: "profanity", "hate", "violence", "spam", "inappropriate_academic", "promotional", "other"
            
            Context: ${context ?? "general academic discussion"}`,
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

export async function checkProfanityWithEscalation(
  userId: string,
  content: string,
  contextType: "post" | "thread" | "material" | "message",
  contextId?: string
): Promise<ProfanityCheckResult> {
  const supabase = await createClient();
  
  // Get user's current profanity status
  const { data: profile } = await supabase
    .from("profiles")
    .select("profanity_warnings, profanity_violations, restriction_level, parent_email, principal_email, school_name, display_name")
    .eq("id", userId)
    .single();

  // Local profanity check
  const profanity = containsProfanity(content);
  if (!profanity.clean) {
    // Determine escalation tier based on current status
    let escalationTier: ProfanityCheckResult["escalationTier"] = "warning";
    let suggestedAction: ProfanityCheckResult["suggestedAction"] = "warn";
    
    if (profile) {
      if (profile.restriction_level === "suspended") {
        escalationTier = "suspension";
        suggestedAction = "suspend";
      } else if (profile.restriction_level === "restricted") {
        escalationTier = "suspension";
        suggestedAction = "suspend";
      } else if (profile.restriction_level === "warning") {
        escalationTier = "restriction";
        suggestedAction = "restrict";
      }
    }

    // Call the database function to handle escalation
    await supabase.rpc("handle_profanity_escalation", {
      p_user_id: userId,
      p_content: content,
      p_detected_words: profanity.words,
      p_context_type: contextType,
      p_context_id: contextId || null,
    });

    return {
      isClean: false,
      riskLevel: "high",
      violations: profanity.words,
      suggestedAction,
      escalationTier,
    };
  }

  // Local spam pre-check
  const spam = containsSpam(content);
  if (spam.isSpam) {
    return {
      isClean: false,
      riskLevel: "medium",
      violations: ["spam"],
      suggestedAction: "warn",
      escalationTier: "none",
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
            6. Promotional / advertising / monetized content (selling products or services, affiliate links, self-promotion that adds no educational value)
            
            Content must be educational and on-topic for a learning community. Return JSON with:
            - is_clean: boolean (false if violations present)
            - risk_level: "none"|"low"|"medium"|"high" (severity)
            - violations: array of violation types
            - suggested_action: "allow"|"warn"|"strike"|"ban"
            
            Violation types: "profanity", "hate", "violence", "spam", "inappropriate_academic", "promotional", "other"
            
            Context: ${contextType ?? "general academic discussion"}`,
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
      const aiResult = JSON.parse(content_text);
      
      if (!aiResult.is_clean && aiResult.risk_level === "high") {
        // Handle AI-detected high-risk content with escalation
        let escalationTier: ProfanityCheckResult["escalationTier"] = "warning";
        let suggestedAction: ProfanityCheckResult["suggestedAction"] = "warn";
        
        if (profile) {
          if (profile.restriction_level === "suspended") {
            escalationTier = "suspension";
            suggestedAction = "suspend";
          } else if (profile.restriction_level === "restricted") {
            escalationTier = "suspension";
            suggestedAction = "suspend";
          } else if (profile.restriction_level === "warning") {
            escalationTier = "restriction";
            suggestedAction = "restrict";
          }
        }

        await supabase.rpc("handle_profanity_escalation", {
          p_user_id: userId,
          p_content: content,
          p_detected_words: aiResult.violations || ["ai-detected"],
          p_context_type: contextType,
          p_context_id: contextId || null,
        });

        return {
          isClean: false,
          riskLevel: "high",
          violations: aiResult.violations,
          suggestedAction,
          escalationTier,
        };
      }

      return {
        isClean: aiResult.is_clean,
        riskLevel: aiResult.risk_level,
        violations: aiResult.violations,
        suggestedAction: aiResult.suggested_action || "allow",
        escalationTier: "none",
      };
    } catch {
      console.error("Failed to parse AI moderation response:", content_text);
    }
  } catch (error) {
    console.error("Groq API error:", error);
  }
  
  return {
    isClean: true,
    riskLevel: "low",
    violations: [],
    suggestedAction: "allow",
    escalationTier: "none",
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
  
  const result = await checkProfanityWithEscalation(post.author_id, post.body, "post", postId);
  
  if (result.isClean || result.riskLevel === "low") {
    return { status: "approved" };
  }
  
  if (result.riskLevel === "high") {
    return { status: "rejected" };
  }
  
  return { status: "flagged" };
}

export async function getUserProfanityStatus(userId: string): Promise<{
  warnings: number;
  violations: number;
  restrictionLevel: string;
  lastIncidentAt: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profanity_status", { p_user_id: userId });
  return data?.[0] || null;
}

export async function isUserRestricted(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_profanity_restricted", { p_user_id: userId });
  return data === true;
}