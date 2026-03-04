export type AppRole = "owner" | "admin" | "vendedor" | "contador";
export type ApproveRole = "admin" | "vendedor" | "contador";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_approved: boolean;
  created_by_app?: string;
};

const VALID_ROLES: AppRole[] = ["owner", "admin", "vendedor", "contador"];
export const APPROVE_ROLES: ApproveRole[] = ["admin", "vendedor", "contador"];

export function normalizeRole(value: unknown): AppRole {
  if (typeof value !== "string") return "vendedor";
  const normalized = value.toLowerCase();
  return VALID_ROLES.includes(normalized as AppRole)
    ? (normalized as AppRole)
    : "vendedor";
}

export function canAccessDashboard(role: AppRole, isApproved: boolean): boolean {
  return role === "owner" || isApproved;
}

export function normalizeApproveRole(value: unknown): ApproveRole {
  if (typeof value !== "string") return "vendedor";
  const normalized = value.toLowerCase();
  return APPROVE_ROLES.includes(normalized as ApproveRole)
    ? (normalized as ApproveRole)
    : "vendedor";
}
