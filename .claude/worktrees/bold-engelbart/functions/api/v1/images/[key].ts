// GET /api/v1/images/:key — serve image from R2
interface Env {
  IMAGES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.params.key as string;

  const object = await context.env.IMAGES.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
};
