import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check for cookies on the incoming request (auth uses cookies)

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn(
        "[avatar] no authenticated user from supabase.auth.getUser()",
      );
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    // Uploading avatar for authenticated user

    const form = await request.formData();
    const file = form.get("avatar") as unknown as File | null;
    if (!file) {
      console.warn("[avatar] missing file in form data");
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    // Convert file to buffer with diagnostics
    const blob = file as unknown as Blob;
    // file metadata may be present; not required

    let buffer: Buffer;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (typeof Buffer === "undefined") {
        console.error("[avatar] Buffer not available in this runtime");
        return NextResponse.json(
          { error: "runtime_missing_buffer" },
          { status: 500 },
        );
      }
      buffer = Buffer.from(arrayBuffer);
      // buffer length available for upload
    } catch (err) {
      console.error("[avatar] error converting file to buffer:", err);
      return NextResponse.json(
        { error: "file_to_buffer_failed", detail: String(err) },
        { status: 500 },
      );
    }

    const bucket = process.env.SUPABASE_BUCKET || "profiles_avatar";
    // Some runtimes expose name, use it if available
    const originalName = (file as unknown as { name?: string })?.name || "img";
    const fileName = `${user.id}/avatar-${Date.now()}-${originalName}`;

    // Determine content type: prefer file.type, otherwise infer from extension
    let contentType = (file as unknown as { type?: string })?.type || "";
    if (!contentType) {
      const ext = (originalName.split(".").pop() || "").toLowerCase();
      const map: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",
        ico: "image/x-icon",
      };
      contentType = map[ext] || "application/octet-stream";
    }
    // determined contentType for upload

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, buffer, { upsert: true, contentType });
      if (uploadError) {
        console.error("[avatar] storage.upload error:", uploadError.message);
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 },
        );
      }
      // storage.upload successful
    } catch (err) {
      console.error("[avatar] storage.upload exception:", err);
      return NextResponse.json(
        { error: "storage_upload_exception", detail: String(err) },
        { status: 500 },
      );
    }

    // Create a signed URL (valid 7 days) so frontend can display it safely
    let publicUrl: string | null = null;
    try {
      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 60 * 60 * 24 * 7);
      if (signedError) {
        console.error("[avatar] createSignedUrl error:", signedError.message);
        return NextResponse.json(
          { error: signedError.message },
          { status: 500 },
        );
      }
      // signed URL created
      publicUrl = signed?.signedUrl || null;
    } catch (err) {
      console.error("[avatar] createSignedUrl exception:", err);
      return NextResponse.json(
        { error: "signed_url_exception", detail: String(err) },
        { status: 500 },
      );
    }

    // Persist avatar_url on profiles so server components can read it
    try {
      const { error: upsertErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (upsertErr) {
        // Return URL but include warning
        return NextResponse.json({
          publicUrl,
          path: fileName,
          warning: upsertErr.message,
        });
      }
    } catch (err) {
      // ignore upsert failure but still return URL
      console.error("[avatar] upsert exception:", err);
    }

    return NextResponse.json({ publicUrl, path: fileName });
  } catch {
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
