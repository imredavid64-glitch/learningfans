import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { DatabaseSetup } from "@/components/setup/database-setup";
import {
  getCurrentProfile,
  getCurrentUser,
  getSchemaStatus,
} from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schemaStatus = await getSchemaStatus();
  if (schemaStatus === "missing_tables") {
    return (
      <div className="flex min-h-full flex-col">
        <DatabaseSetup />
      </div>
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <div className="flex min-h-full flex-col">
        <DatabaseSetup />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppNav profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
