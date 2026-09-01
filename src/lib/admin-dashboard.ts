import { listRecentSecurityActivity, type SecurityActivityItem } from "./admin-security";

const SEVEN_DAYS_MS = 7 * 86_400_000;
export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 5;

export interface AdminDashboardMetrics {
  totalAccounts: number;
  currentBans: number;
  activeSessions: number;
  recentAccounts: number;
}

export interface AdminDashboardResult {
  metrics: AdminDashboardMetrics;
  recentActivity: SecurityActivityItem[];
}

interface DashboardMetricsRow {
  total_accounts: number;
  current_bans: number;
  active_sessions: number;
  recent_accounts: number;
}

export async function getAdminDashboard(
  database: D1Database,
  now = Date.now(),
): Promise<AdminDashboardResult> {
  const metrics = await database
    .prepare(
      `SELECT
        (SELECT count(*) FROM user) AS total_accounts,
        (SELECT count(*) FROM user
          WHERE banned = 1 AND (ban_expires IS NULL OR ban_expires > ?)) AS current_bans,
        (SELECT count(*) FROM session WHERE expires_at > ?) AS active_sessions,
        (SELECT count(*) FROM user WHERE created_at >= ? AND created_at <= ?) AS recent_accounts`,
    )
    .bind(now, now, now - SEVEN_DAYS_MS, now)
    .first<DashboardMetricsRow>();
  if (!metrics) throw new Error("Unable to read Admin Dashboard metrics");

  const recentActivity = await listRecentSecurityActivity(
    database,
    DASHBOARD_RECENT_ACTIVITY_LIMIT,
  );

  return {
    metrics: {
      totalAccounts: metrics.total_accounts,
      currentBans: metrics.current_bans,
      activeSessions: metrics.active_sessions,
      recentAccounts: metrics.recent_accounts,
    },
    recentActivity,
  };
}
