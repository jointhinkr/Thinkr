import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function YouPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (data?.username) redirect(`/profile/${data.username}`);
  redirect("/flux");
}
