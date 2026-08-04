import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "uploads";
const RESUME_BUCKET = "resumes";

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

export type SavedResume = { path: string; name: string };

/**
 * Upload a resume to the PRIVATE "resumes" bucket, namespaced by intern id.
 * Returns the storage path (NOT a public URL) — access is via signed links.
 */
export async function saveResume(file: File, internId: string): Promise<SavedResume | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const path = `${internId}/${unique}-${safeName(file.name || "resume")}`;

  const supabase = client();
  const { error } = await supabase.storage.from(RESUME_BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`이력서 업로드 실패: ${error.message}`);
  return { path, name: file.name || "resume" };
}

/** A short-lived signed download URL for a private resume. Null on failure. */
export async function signedResumeUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const supabase = client();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Delete a resume file from the private bucket (best-effort). */
export async function deleteResume(path: string): Promise<void> {
  const supabase = client();
  await supabase.storage.from(RESUME_BUCKET).remove([path]);
}
