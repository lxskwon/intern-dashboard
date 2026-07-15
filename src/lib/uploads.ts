import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "uploads";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export type SavedFile = { url: string; name: string; isImage: boolean };

// Created lazily so a missing env var doesn't crash the build.
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Upload a File to the Supabase Storage "uploads" bucket and return its public
 * URL. Returns null for empty inputs.
 */
export async function saveUpload(file: File): Promise<SavedFile | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const path = `${unique}-${safeName(file.name || "file")}`;

  const supabase = client();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    name: file.name || path,
    isImage: (file.type || "").startsWith("image/"),
  };
}
