import { createServerClient } from "@supabase/ssr";

const STORAGE_THRESHOLD = 0.8;
const ARCHIVE_THRESHOLD = 0.8;
const FREE_TIER_BYTES = 500 * 1024 * 1024;

let archiveClient: ReturnType<typeof createServerClient> | null = null;

function getArchiveClient() {
  const url = process.env.ARCHIVE_SUPABASE_URL;
  const key = process.env.ARCHIVE_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  if (!archiveClient) {
    archiveClient = createServerClient(url, key, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
  }
  return archiveClient;
}

async function getDatabaseSize(): Promise<{ totalBytes: number; usagePercent: number }> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data } = await supabase.rpc("get_db_size");
    const bytes = typeof data === "number" ? data : FREE_TIER_BYTES;
    return { totalBytes: bytes, usagePercent: bytes / FREE_TIER_BYTES };
  } catch {
    return { totalBytes: 0, usagePercent: 0 };
  }
}

interface ArchiveRecord {
  table: string;
  id: string;
  data: Record<string, unknown>;
  archived_at: string;
}

type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in";

async function getArchiveCount(): Promise<number> {
  const client = getArchiveClient();
  if (!client) return 0;
  const { count } = await client
    .from("archived_records")
    .select("*", { count: "exact", head: true });
  return count || 0;
}

async function deleteOldestArchives(count: number): Promise<void> {
  const client = getArchiveClient();
  if (!client) return;

  const { data: oldest } = await client
    .from("archived_records")
    .select("id")
    .order("archived_at", { ascending: true })
    .limit(count);

  if (oldest && oldest.length > 0) {
    const ids = oldest.map((r: { id: string }) => r.id);
    await client.from("archived_records").delete().in("id", ids);
  }
}

export async function shouldArchive(): Promise<boolean> {
  const { usagePercent } = await getDatabaseSize();
  return usagePercent >= STORAGE_THRESHOLD;
}

export async function archiveOldData(): Promise<{ archived: number; deleted: number }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const archiveDb = getArchiveClient();
  if (!archiveDb) return { archived: 0, deleted: 0 };

  let archived = 0;
  let deleted = 0;

  // Per-table retention: logs/reports go after 30 days; chat history after 90
  // (rooms keep a longer window, and old messages are preserved in the
  // archive project rather than destroyed).
  const tables = [
    { table: "moderation_actions", dateCol: "created_at", olderThanDays: 30 },
    { table: "audit_log", dateCol: "created_at", olderThanDays: 30 },
    { table: "reports", dateCol: "created_at", extraCondition: "status.eq.resolved", olderThanDays: 30 },
    { table: "study_room_messages", dateCol: "created_at", olderThanDays: 90 },
  ];

  for (const { table, dateCol, extraCondition, olderThanDays } of tables) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from(table)
      .select("*")
      .lt(dateCol, cutoff)
      .limit(500);

    if (extraCondition) {
      const [col, op, val] = extraCondition.split(".");
      query = query.filter(col, op as FilterOperator, val);
    }

    const { data: oldRecords } = await query;

    if (!oldRecords || oldRecords.length === 0) continue;

    for (const record of oldRecords) {
      const archiveRecord: ArchiveRecord = {
        table,
        id: record.id,
        data: record,
        archived_at: new Date().toISOString(),
      };

      const { error: insertError } = await archiveDb
        .from("archived_records")
        .insert(archiveRecord);

      if (!insertError) {
        await supabase.from(table).delete().eq("id", record.id);
        archived++;
      }
    }
  }

  const archiveCount = await getArchiveCount();
  const archiveLimit = 10000;
  if (archiveCount > archiveLimit * ARCHIVE_THRESHOLD) {
    const toDelete = Math.floor(archiveCount - archiveLimit * 0.5);
    await deleteOldestArchives(toDelete);
    deleted = toDelete;
  }

  return { archived, deleted };
}

export async function getStorageStatus(): Promise<{
  mainUsagePercent: number;
  archiveCount: number;
  needsArchive: boolean;
}> {
  const { usagePercent } = await getDatabaseSize();
  const archiveCount = await getArchiveCount();
  return {
    mainUsagePercent: Math.round(usagePercent * 100),
    archiveCount,
    needsArchive: usagePercent >= STORAGE_THRESHOLD,
  };
}

export async function getDbUsageReport(): Promise<{
  totalBytes: number;
  usagePercent: number;
  archiveConfigured: boolean;
  archiveCount: number;
  needsArchive: boolean;
}> {
  const { totalBytes, usagePercent } = await getDatabaseSize();
  return {
    totalBytes,
    usagePercent,
    archiveConfigured: Boolean(
      process.env.ARCHIVE_SUPABASE_URL && process.env.ARCHIVE_SUPABASE_SERVICE_KEY,
    ),
    archiveCount: await getArchiveCount(),
    needsArchive: usagePercent >= STORAGE_THRESHOLD,
  };
}
