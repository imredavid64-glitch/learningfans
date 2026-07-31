"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isAdmin } from "@/lib/auth";
import { provisionSchool, getSchools, deleteSchool as deleteSchoolRecord, checkSchoolHealth } from "@/lib/schools";
import { getOrganizations } from "@/lib/supabase-mgmt";
import { analyzeSchoolSecurity, generateSetupInstructions } from "@/lib/ai-agent";

export async function createSchool(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim();
  const organizationId = String(formData.get("organizationId") ?? "").trim();

  if (!name || !adminEmail || !organizationId) {
    redirect("/app/admin/schools?error=All%20fields%20required");
  }

  try {
    await provisionSchool(name, adminEmail, organizationId);
  } catch (err) {
    redirect(`/app/admin/schools?error=${encodeURIComponent(err instanceof Error ? err.message : "Provisioning failed")}`);
  }

  revalidatePath("/app/admin/schools");
  redirect("/app/admin/schools?success=School%20provisioned");
}

export async function deleteSchool(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const schoolId = String(formData.get("schoolId") ?? "");
  if (!schoolId) return;

  await deleteSchoolRecord(schoolId);
  revalidatePath("/app/admin/schools");
}

export async function checkSchoolsHealth(): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const schools = await getSchools();
  for (const school of schools) {
    if (!school.supabase_project_ref) continue;
    await checkSchoolHealth(school.id);
  }

  revalidatePath("/app/admin/schools");
}

export async function runAIAnalysis(): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const supabase = await createClient();
  const schools = await getSchools();
  const healthData = [];

  for (const school of schools) {
    if (school.status !== "active") continue;

    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: spaceCount } = await supabase
      .from("spaces")
      .select("*", { count: "exact", head: true });

    const { count: reportCount } = await supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    const { count: sanctionCount } = await supabase
      .from("user_sanctions")
      .select("*", { count: "exact", head: true });

    healthData.push({
      name: school.name,
      slug: school.slug,
      user_count: userCount || 0,
      space_count: spaceCount || 0,
      report_count: reportCount || 0,
      sanction_count: sanctionCount || 0,
      last_health_check: school.last_health_check_at as string | null,
      db_size_mb: 0,
    });

    try {
      const report = await analyzeSchoolSecurity(healthData[healthData.length - 1]);
      if (report.overall_risk === "high" || report.overall_risk === "medium") {
        await supabase.from("audit_log").insert({
          user_id: profile.id,
          action: "ai_security_alert",
          metadata: {
            school_id: school.id,
            school_name: school.name,
            risk: report.overall_risk,
            threats: report.threats_found,
            warnings: report.warnings,
          },
        });
      }
    } catch {
      // AI analysis failed for this school, continue
    }
  }

  revalidatePath("/app/admin/schools");
}

export async function getSchoolSetupInstructions(schoolId: string): Promise<string> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return "";

  const supabase = await createClient();
  const { data: school } = await supabase.from("schools").select("*").eq("id", schoolId).single();
  if (!school) return "School not found";

  return generateSetupInstructions(school.name, school.supabase_url || "https://learningfans.vercel.app");
}

export async function getOrganizationsList() {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return [];

  try {
    return await getOrganizations();
  } catch {
    return [];
  }
}
