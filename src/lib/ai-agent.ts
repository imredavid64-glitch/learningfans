import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(getGeminiKey());
  }
  return genAI;
}

async function callGemini(prompt: string): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export interface SecurityReport {
  school_name: string;
  threats_found: number;
  warnings: string[];
  recommendations: string[];
  overall_risk: "low" | "medium" | "high";
}

export interface SchoolHealthData {
  name: string;
  slug: string;
  user_count: number;
  space_count: number;
  report_count: number;
  sanction_count: number;
  last_health_check: string | null;
  db_size_mb: number;
}

export async function analyzeSchoolSecurity(school: SchoolHealthData): Promise<SecurityReport> {
  const prompt = `You are a security AI agent monitoring a multi-tenant education platform called LearningFans.
Analyze the following school data and produce a security report.

School: ${school.name}
Total Users: ${school.user_count}
Total Spaces: ${school.space_count}
Open Reports: ${school.report_count}
Active Sanctions: ${school.sanction_count}
Database Size: ${school.db_size_mb} MB
Last Health Check: ${school.last_health_check || "Never"}

Analyze for:
1. Unusual activity patterns (high report-to-user ratio, many sanctions)
2. Database size anomalies
3. Engagement concerns (spaces per user ratio)
4. Security recommendations specific to this school

Provide a JSON response with:
{
  "threats_found": number,
  "warnings": [string array of specific findings],
  "recommendations": [string array of actionable recommendations],
  "overall_risk": "low" | "medium" | "high"
}`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SecurityReport;
    }
    return {
      school_name: school.name,
      threats_found: 0,
      warnings: ["Could not parse AI response"],
      recommendations: ["Manual review recommended"],
      overall_risk: "low",
    };
  } catch (err) {
    return {
      school_name: school.name,
      threats_found: -1,
      warnings: [`AI analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`],
      recommendations: ["Retry analysis later"],
      overall_risk: "medium",
    };
  }
}

export async function generateSecuritySummary(schools: SchoolHealthData[]): Promise<string> {
  const prompt = `You are a security AI agent for LearningFans, a multi-tenant education platform.
Summarize the security posture of ${schools.length} schools in 2-3 paragraphs.

Schools data: ${JSON.stringify(schools.map((s) => ({
  name: s.name,
  users: s.user_count,
  spaces: s.space_count,
  reports: s.report_count,
  sanctions: s.sanction_count,
})))}

Highlight any schools that need attention and provide a concise summary.`;

  try {
    return await callGemini(prompt);
  } catch {
    return "Security summary unavailable at this time. Please check individual school reports.";
  }
}

export async function generateSetupInstructions(schoolName: string, schoolUrl: string): Promise<string> {
  const prompt = `You are an AI setup agent for LearningFans. A new school "${schoolName}" has just been provisioned at ${schoolUrl}.
Generate a brief setup guide (3-5 bullet points) for the school administrator covering:
1. How to invite students and teachers
2. How to create study spaces
3. How to configure security settings
4. How to use the time tracker and schedule features
5. How to enable AI moderation

Keep it concise and actionable.`;

  try {
    return await callGemini(prompt);
  } catch {
    return "Setup instructions unavailable. Visit the LearningFans documentation for guidance.";
  }
}

export async function detectAnomalies(school: SchoolHealthData): Promise<string[]> {
  const anomalies: string[] = [];

  if (school.report_count > 0 && school.user_count > 0) {
    const reportRatio = school.report_count / school.user_count;
    if (reportRatio > 0.5) {
      anomalies.push(`High report-to-user ratio (${(reportRatio * 100).toFixed(1)}%): ${school.report_count} reports from ${school.user_count} users`);
    }
  }

  if (school.db_size_mb > 500) {
    anomalies.push(`Large database (${school.db_size_mb} MB) — consider archival`);
  }

  if (school.space_count === 0 && school.user_count > 5) {
    anomalies.push(`${school.user_count} users but no study spaces created yet`);
  }

  if (school.sanction_count > school.user_count * 0.2) {
    anomalies.push(`High sanction rate: ${school.sanction_count} sanctions for ${school.user_count} users`);
  }

  if (anomalies.length > 0) {
    const prompt = `You are a security AI agent. Review these anomalies detected for school "${school.name}":
${anomalies.map((a) => `- ${a}`).join("\n")}

For each anomaly, provide a brief risk assessment and suggested action. Keep it concise.`;

    try {
      const analysis = await callGemini(prompt);
      return [`AI analysis for ${school.name}:`, analysis];
    } catch {
      return anomalies;
    }
  }

  return ["No anomalies detected"];
}
