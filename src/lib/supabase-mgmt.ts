const SUPABASE_MGMT_API = "https://api.supabase.com/v1";

function getToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not set");
  return token;
}

async function mgmtFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_MGMT_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Supabase Management API error: ${body.message || res.statusText}`);
  }
  return body;
}

export async function createProject(name: string, organizationId: string, region = "us-east-1") {
  return mgmtFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      organization_id: organizationId,
      region,
      plan: "free",
    }),
  });
}

export async function getProject(projectRef: string) {
  return mgmtFetch(`/projects/${projectRef}`);
}

export async function waitForProjectReady(projectRef: string, maxRetries = 30, delayMs = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    const project = await getProject(projectRef);
    if (project.status === "ACTIVE_HEALTHY" || project.status === "ACTIVE") {
      return project;
    }
    if (project.status === "ERROR" || project.status === "INACTIVE") {
      throw new Error(`Project ${projectRef} entered bad state: ${project.status}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Project ${projectRef} did not become ready within timeout`);
}

export async function getProjectApiKeys(projectRef: string) {
  const keys = await mgmtFetch(`/projects/${projectRef}/api-keys`);
  const anon = keys.find((k: { name: string }) => k.name === "anon");
  const serviceRole = keys.find((k: { name: string }) => k.name === "service_role");
  return {
    anonKey: anon?.api_key as string,
    serviceRoleKey: serviceRole?.api_key as string,
  };
}

export async function getOrganizations() {
  return mgmtFetch("/organizations") as Promise<Array<{ id: string; name: string; slug: string }>>;
}

export async function runSql(projectRef: string, query: string) {
  return mgmtFetch(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function runSqlBatch(projectRef: string, statements: string[]) {
  for (const stmt of statements) {
    try {
      await runSql(projectRef, stmt);
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) continue;
      throw err;
    }
  }
}

export async function updateProjectAuthSettings(projectRef: string, settings: Record<string, unknown>) {
  return mgmtFetch(`/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}
