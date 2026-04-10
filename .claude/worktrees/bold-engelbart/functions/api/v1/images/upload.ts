// POST /api/v1/images/upload — upload base64 image to R2, return public URL
import { requireAuth } from '../_lib/auth';

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CF_ACCOUNT_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAuth(context, 'ADMIN');
  if (authResult instanceof Response) return authResult;

  try {
    const { image, filename } = await context.request.json<{ image: string; filename?: string }>();
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // Parse base64 data URI
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid base64 image' }), { status: 400 });
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Generate unique filename
    const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const key = `${filename || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to R2
    await context.env.IMAGES.put(key, buffer, {
      httpMetadata: { contentType: mimeType },
    });

    // Return the public URL (via custom domain or R2 public access)
    const url = `/api/v1/images/${key}`;

    return new Response(JSON.stringify({ url, key }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
