import { join, extname, basename } from "@std/path";
import { load } from "@std/dotenv";

const env = await load();
const MOVIES_DIR = env["MOVIES_DIR"] || Deno.env.get("MOVIES_DIR") || "/home/koushikk/Documents/anew/tor/movie";
const DIST_DIR = env["DIST_DIR"] || Deno.env.get("DIST_DIR") || "../dist";
const PORT = parseInt(env["PORT"] || Deno.env.get("PORT") || "8000");

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listMovies(dir: string): Promise<any[]> {
  const movies: any[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      movies.push(...(await listMovies(fullPath)));
    } else if (entry.isFile && [".mkv", ".mp4"].includes(extname(entry.name).toLowerCase())) {
      const relativePath = fullPath.replace(MOVIES_DIR, "");
      const base = fullPath.substring(0, fullPath.lastIndexOf('.'));
      
      let subtitlePath = null;
      if (await exists(base + ".srt")) subtitlePath = (base + ".srt").replace(MOVIES_DIR, "");
      else if (await exists(base + ".vtt")) subtitlePath = (base + ".vtt").replace(MOVIES_DIR, "");

      movies.push({
        path: relativePath,
        name: entry.name,
        hasSubtitles: !!subtitlePath,
        subtitlePath
      });
    }
  }
  return movies;
}

function getContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
  };
  return types[ext] || "application/octet-stream";
}

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req) => {
  const url = new URL(req.url);

  // CORS and Security Headers
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") || "Range, Content-Type",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length, Content-Type",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }

  // API: List Movies
  if (url.pathname === "/api/movies") {
    const movies = await listMovies(MOVIES_DIR);
    return new Response(JSON.stringify(movies), {
      headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
    });
  }

  // API: Subtitles
  if (url.pathname === "/api/subtitles") {
    const subPath = url.searchParams.get("path");
    if (!subPath) return new Response("Missing path", { status: 400, headers });
    const fullPath = join(MOVIES_DIR, subPath);
    try {
      const content = await Deno.readTextFile(fullPath);
      headers.set("Content-Type", "text/plain; charset=utf-8");
      return new Response(content, { headers });
    } catch (e) {
      return new Response("Not found", { status: 404, headers });
    }
  }

  // API: Stream Video
  if (url.pathname === "/api/stream") {
    const moviePath = url.searchParams.get("path");
    console.log(`[Stream] Movie path param: ${moviePath}`);
    
    if (!moviePath) return new Response("Missing path", { status: 400, headers });

    const fullPath = join(MOVIES_DIR, moviePath);
    console.log(`[Stream] Full path: ${fullPath}`);
    
    try {
      const file = await Deno.open(fullPath, { read: true });
      const { size } = await file.stat();
      const range = req.headers.get("range");
      const contentType = getContentType(fullPath);
      
      console.log(`[Stream] Raw Range header: ${range}`);
      console.log(`[Stream] File size: ${size}`);
      console.log(`[Stream] Content-Type: ${contentType}`);

      const MAX_CHUNK_SIZE = 10 * 1024 * 1024;
      let start = 0;
      let end = size - 1;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      }

      // Force a maximum chunk size for ALL video/audio requests
      if (end - start + 1 > MAX_CHUNK_SIZE) {
        end = start + MAX_CHUNK_SIZE - 1;
      }

      if (start >= size || end >= size) {
        headers.set("Content-Range", `bytes */${size}`);
        return new Response("Range Not Satisfiable", { status: 416, headers });
      }

      const chunkSize = end - start + 1;
      console.log(`[Stream] Range: ${range ? 'provided' : 'missing'}, start: ${start}, end: ${end}, chunkSize: ${chunkSize}`);
      
      await file.seek(start, Deno.SeekMode.Start);
      
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Content-Type", contentType);

      console.log(`[Stream] Responding with 206, Content-Range: bytes ${start}-${end}/${size}`);
      
      // Only stream the requested chunk
      let bytesSent = 0;
      const limitedStream = file.readable.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          const remaining = chunkSize - bytesSent;
          if (remaining <= 0) {
            controller.terminate();
            return;
          }
          if (chunk.length <= remaining) {
            controller.enqueue(chunk);
            bytesSent += chunk.length;
          } else {
            controller.enqueue(chunk.subarray(0, remaining));
            bytesSent += remaining;
            controller.terminate();
          }
        }
      }));

      return new Response(limitedStream, {
        status: 206,
        headers,
      });
    } catch (e) {
      console.error(`[Stream] Error:`, e);
      return new Response("File not found", { status: 404, headers });
    }
  }

  // Serve static files from dist/
  if (!url.pathname.startsWith("/api")) {
    const distPath = join(DIST_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    if (await exists(distPath)) {
      const file = await Deno.open(distPath, { read: true });
      const contentType = getContentType(distPath);
      headers.set("Content-Type", contentType);
      return new Response(file.readable, { headers });
    }

    // SPA fallback - serve index.html for client-side routes
    const indexPath = join(DIST_DIR, "index.html");
    if (await exists(indexPath)) {
      const content = await Deno.readTextFile(indexPath);
      headers.set("Content-Type", "text/html");
      return new Response(content, { headers });
    }
  }

  return new Response("Not Found", { status: 404, headers });
});
