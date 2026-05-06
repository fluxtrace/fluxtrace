/**
 * Decide SSL para `pg` quando DATABASE_SSL não está definido (ex.: migração local → Postgres na Render).
 * Manter em sincronia com boas práticas das clouds; DATABASE_SSL=false força sem SSL.
 */
export function isHostedPostgresHostname(databaseUrl: string): boolean {
  try {
    const normalized = databaseUrl.trim().replace(/^postgresql:/i, "http:");
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    return (
      host.endsWith(".render.com") ||
      host.endsWith(".neon.tech") ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".railway.app") ||
      host.includes(".rds.amazonaws.com") ||
      host.includes(".database.azure.com") ||
      host.endsWith(".ondigitalocean.com") ||
      host.endsWith(".cockroachlabs.cloud")
    );
  } catch {
    return false;
  }
}

export type PgSslResolution = {
  ssl: { rejectUnauthorized: boolean } | undefined;
  /** Para logs / diagnóstico (sem secrets). */
  reason: string;
};

export function resolvePgSslForUrl(databaseUrl: string): PgSslResolution {
  const sslFlag = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (sslFlag === "false" || sslFlag === "0") {
    return { ssl: undefined, reason: "DATABASE_SSL desativado explicitamente" };
  }
  if (sslFlag === "true" || sslFlag === "1" || sslFlag === "require") {
    return { ssl: { rejectUnauthorized: false }, reason: "DATABASE_SSL=true" };
  }
  if (/sslmode=require|sslmode=no-verify|ssl=true/i.test(databaseUrl)) {
    return { ssl: { rejectUnauthorized: false }, reason: "sslmode/ssl na DATABASE_URL" };
  }
  if (isHostedPostgresHostname(databaseUrl)) {
    return {
      ssl: { rejectUnauthorized: false },
      reason: "hostname de Postgres alojado (Render/Neon/Supabase/…)",
    };
  }
  return { ssl: undefined, reason: "ligação local / sem SSL inferido" };
}
