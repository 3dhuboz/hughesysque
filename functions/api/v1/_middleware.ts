// Global error handler for all API v1 endpoints
export const onRequest = async (context: any) => {
  try {
    return await context.next();
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
