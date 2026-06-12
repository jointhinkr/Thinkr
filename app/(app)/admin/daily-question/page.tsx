import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/permissions";
import DailyQuestionForm from "./form";

// Admin-only. Enforced on the SERVER: a non-admin (or logged-out) request never
// receives the editor — it's redirected before any of it renders. Writes are
// additionally gated in the DB by set_daily_question() (admins only).
export default async function AdminDailyQuestionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdmin(profile)) redirect("/flux");

  const today = new Date().toISOString().split("T")[0];
  const { data: prompt } = await supabase
    .from("spark_prompts").select("prompt").eq("active_date", today).maybeSingle();

  return <DailyQuestionForm current={prompt?.prompt ?? ""} />;
}
