export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Intercept local image requests and stream them directly from local R2 storage
    if (pathname.startsWith('/cdn-cgi/image/')) {
      // Strip out the /cdn-cgi/image/width=...,format=.../ prefix to get the raw R2 key
      const r2Key = pathname.replace(/^\/cdn-cgi\/image\/[^/]+\//, '');
      
      const object = await env.BUCKET.get(r2Key);
      if (!object) {
        return new Response('Image not found in local R2', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      
      return new Response(object.body, { headers });
    }

    // 2. Bypass worker logic for static frontend assets (JS, CSS, Vite files)
    if (
      pathname.includes('.') || 
      pathname.startsWith('/assets/') || 
      pathname === '/favicon.ico'
    ) {
      return env.ASSETS.fetch(request);
    }

    // 3. Parse path segments for API and routing
    const pathParts = pathname.split('/').filter(Boolean);
    const dogSlug = pathParts[0];
    const subRoute = pathParts[1];

    if (!dogSlug) {
      return new Response('Welcome to Poochert! Try visiting /bailey', { status: 200 });
    }

    // 4. Check D1 Database for the dog slug and active subscription
    const dog = await env.DB.prepare(
      "SELECT * FROM dogs WHERE slug = ? AND subscription_status = 'active'"
    ).bind(dogSlug).first();

    if (!dog) {
      return new Response('Dog profile not found or subscription inactive.', { status: 404 });
    }

    // 5. Handle API requests for this dog's photo timeline
    if (subRoute === 'api' && pathParts[2] === 'photos') {
      const { results } = await env.DB.prepare(
        "SELECT r2_key, taken_at, caption FROM photos WHERE dog_id = ? ORDER BY taken_at ASC"
      ).bind(dog.id).all();

      const photosWithCdnUrls = results.map(photo => ({
        url: `/cdn-cgi/image/width=400,format=auto/${photo.r2_key}`,
        takenAt: photo.taken_at,
        caption: photo.caption
      }));

      return Response.json({
        dogName: dog.name,
        photos: photosWithCdnUrls
      });
    }

    // 6. Serve the React SPA entry point for valid dog routes
    return env.ASSETS.fetch(new URL('/index.html', request.url));
  }
};