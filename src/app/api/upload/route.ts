import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Where uploads are written. Defaults to public/uploads (served at /uploads on a
// node-server / persistent-disk host). Override with UPLOAD_DIR for a mounted
// volume. Serverless hosts have a read-only FS — use object storage there.
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || join(process.cwd(), "public", "uploads");

// POST /api/upload — multipart file field "file". Returns { url } for use as an
// image URL (e.g. a listing photo). Requires login.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "이미지 파일(JPG/PNG/WEBP/GIF)만 업로드할 수 있어요." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "이미지는 5MB 이하만 업로드할 수 있어요." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), bytes);

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
