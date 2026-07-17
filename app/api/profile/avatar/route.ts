import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadFile } from "@/lib/storage/spaces";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      console.warn("[avatar] no authenticated user session");
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("avatar") as unknown as File | null;
    if (!file) {
      console.warn("[avatar] missing file in form data");
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    // Convert file to buffer with diagnostics
    const blob = file as unknown as Blob;
    let buffer: Buffer;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (err) {
      console.error("[avatar] error converting file to buffer:", err);
      return NextResponse.json(
        { error: "file_to_buffer_failed", detail: String(err) },
        { status: 500 },
      );
    }

    const bucket = "profiles_avatar";
    const originalName = (file as unknown as { name?: string })?.name || "img";
    const fileName = `${session.userId}/avatar-${Date.now()}-${originalName}`;

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

    let publicUrl: string;
    try {
      const uploadResult = await uploadFile(fileName, buffer, {
        contentType,
        isPublic: true,
        bucket,
      });
      publicUrl = uploadResult.publicUrl;
    } catch (err) {
      console.error("[avatar] storage.upload exception:", err);
      return NextResponse.json(
        { error: "storage_upload_exception", detail: String(err) },
        { status: 500 },
      );
    }

    // Persist avatar_url on profiles so server components can read it
    try {
      await query(
        "UPDATE public.profiles SET avatar_url = $1 WHERE id = $2",
        [publicUrl, session.userId]
      );
    } catch (err) {
      console.error("[avatar] profile update exception:", err);
    }

    return NextResponse.json({ publicUrl, path: fileName });
  } catch (err) {
    console.error("[avatar] unexpected exception:", err);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}

