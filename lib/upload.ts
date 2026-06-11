import { createClient } from "@/lib/supabase/client";

// Uploads a file into <bucket>/<uid>/<timestamp>.<ext> and returns its public URL.
export async function uploadToBucket(bucket: "avatars" | "media", file: File): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function mediaTypeOf(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
