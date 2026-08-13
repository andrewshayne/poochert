export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // 1. Direct R2 image streaming route
    if (pathname.startsWith('/api/image/')) {
      const r2Key = pathname.replace('/api/image/', '');
      const object = await env.BUCKET.get(r2Key);
      
      if (!object) {
        return new Response('Image not found in R2', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      return new Response(object.body, { headers });
    }

    // 2. Bypass worker logic for static frontend assets
    if (
      pathname.includes('.') || 
      pathname.startsWith('/assets/') || 
      pathname === '/favicon.ico'
    ) {
      return env.ASSETS.fetch(request);
    }

    const pathParts = pathname.split('/').filter(Boolean);
    const dogSlug = pathParts[0];
    const subRoute = pathParts[1];

    if (!dogSlug) {
      return new Response('Welcome to Poochert! Try visiting /bailey', { status: 200 });
    }

    // Verify dog exists
    const dog = await env.DB.prepare(
      "SELECT * FROM dogs WHERE slug = ? AND subscription_status = 'active'"
    ).bind(dogSlug).first();

    if (!dog) {
      return new Response('Dog profile not found or subscription inactive.', { status: 404 });
    }

    // --- ADMIN AUTH & WRITE ROUTES ---
    if (subRoute === 'api' && pathParts[2] === 'verify-admin' && method === 'POST') {
      const adminSecret = request.headers.get('X-Admin-Secret');
      if (adminSecret !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      return Response.json({ success: true });
    }

    if (subRoute === 'api' && pathParts[2] === 'upload' && method === 'POST') {
      const adminSecret = request.headers.get('X-Admin-Secret');
      if (adminSecret !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const formData = await request.formData();
      const file = formData.get('file');
      const takenAt = formData.get('takenAt') || new Date().toISOString().split('T')[0];
      const caption = formData.get('caption') || '';

      if (!file) {
        return new Response('No file provided', { status: 400 });
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const uuid = crypto.randomUUID();
      const r2Key = `dogs/${dog.slug}/originals/${uuid}.${fileExt}`;

      await env.BUCKET.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      const photoId = 'p_' + Math.random().toString(36).substring(2, 9);
      await env.DB.prepare(
        "INSERT INTO photos (id, dog_id, r2_key, taken_at, caption) VALUES (?, ?, ?, ?, ?)"
      ).bind(photoId, dog.id, r2Key, takenAt, caption).run();

      return Response.json({ success: true, photoId });
    }

    if (subRoute === 'api' && pathParts[2] === 'photos' && pathParts[3] && method === 'PATCH') {
      const adminSecret = request.headers.get('X-Admin-Secret');
      if (adminSecret !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const photoId = pathParts[3];
      const body = await request.json();
      const { takenAt, caption } = body;

      await env.DB.prepare(
        "UPDATE photos SET taken_at = COALESCE(?, taken_at), caption = COALESCE(?, caption) WHERE id = ? AND dog_id = ?"
      ).bind(takenAt, caption, photoId, dog.id).run();

      return Response.json({ success: true });
    }

    if (subRoute === 'api' && pathParts[2] === 'photos' && pathParts[3] && method === 'DELETE') {
      const adminSecret = request.headers.get('X-Admin-Secret');
      if (adminSecret !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const photoId = pathParts[3];

      const photo = await env.DB.prepare(
        "SELECT r2_key FROM photos WHERE id = ? AND dog_id = ?"
      ).bind(photoId, dog.id).first();

      if (!photo) {
        return new Response('Photo not found', { status: 404 });
      }

      await env.BUCKET.delete(photo.r2_key);

      await env.DB.prepare(
        "DELETE FROM photos WHERE id = ? AND dog_id = ?"
      ).bind(photoId, dog.id).run();

      return Response.json({ success: true });
    }
    // -------------------------------------------------------------

    // 3. Handle API GET requests for timeline photos
    if (subRoute === 'api' && pathParts[2] === 'photos') {
      const { results } = await env.DB.prepare(
        "SELECT id, r2_key, taken_at, caption FROM photos WHERE dog_id = ? ORDER BY taken_at ASC"
      ).bind(dog.id).all();

      const photosWithCdnUrls = results.map(photo => ({
        id: photo.id,
        url: `/api/image/${photo.r2_key}`,
        takenAt: photo.taken_at,
        caption: photo.caption
      }));

      return Response.json({
        dogName: dog.name,
        photos: photosWithCdnUrls
      });
    }

    // 4. Serve the React SPA entry point
    return env.ASSETS.fetch(new URL('/index.html', request.url));
  }
};