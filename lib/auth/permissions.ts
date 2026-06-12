// Reusable permission helpers. Use these everywhere instead of checking the raw
// `role` string, and never hardcode a user id. `user` here is the profile row
// (or anything carrying a `role`). admin inherits premium.
//
// These are pure checks — the real enforcement is server-side: Server
// Components / Route Handlers call these against the DB-fetched profile, and
// the database mirrors them via private.is_admin() / private.has_premium()
// in RLS + SECURITY DEFINER functions.

export type RoleBearer = { role?: string | null } | null | undefined;

export function isAdmin(user: RoleBearer): boolean {
  return !!user && user.role === "admin";
}

export function hasPremium(user: RoleBearer): boolean {
  return !!user && (user.role === "premium" || user.role === "admin");
}
