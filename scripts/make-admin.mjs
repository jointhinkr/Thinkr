// One-off admin seed. Promotes exactly one account (by email) to role=admin.
// Uses the service role key, so it bypasses RLS and the role-change guard.
// There is intentionally NO route or UI that does this — admin is granted only
// by you running this command.
//
// Usage (Node 20+):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=you@example.com \
//     node scripts/make-admin.mjs
//
// The service role key is in Supabase → Project Settings → API → service_role.
// Never commit it.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
if (!email) {
  console.error("Set ADMIN_EMAIL to the account you want to make admin.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

let userId = null;
for (let page = 1; page <= 50 && !userId; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Could not list users:", error.message);
    process.exit(1);
  }
  const match = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (match) userId = match.id;
  if (data.users.length < 200) break;
}

if (!userId) {
  console.error(`No account found for ${email}. Make sure they've signed up.`);
  process.exit(1);
}

const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
if (error) {
  console.error("Failed to set role:", error.message);
  process.exit(1);
}

console.log(`✅ ${email} is now an admin.`);
