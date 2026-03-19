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
  if (!(await exists(dir))) return [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      movies.push(...(await listMovies(fullPath)));
    } else if (entry.isFile && [".mkv", ".mp4", ".webm"].includes(extname(entry.name).toLowerCase())) {
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
  // Removed restrictive COOP/COEP as they are not needed for standard <video> 
  // and can cause issues with loading resources.
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") || "Range, Content-Type",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length, Content-Type",
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
    if (!moviePath) return new Response("Missing path", { status: 400, headers });

    const fullPath = join(MOVIES_DIR, moviePath);
    
    try {
      const file = await Deno.open(fullPath, { read: true });
      const { size } = await file.stat();
      const range = req.headers.get("range");
      const contentType = getContentType(fullPath);
      
      let start = 0;
      let end = size - 1;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      }

      if (start >= size || end >= size) {
        headers.set("Content-Range", `bytes */${size}`);
        return new Response("Range Not Satisfiable", { status: 416, headers });
      }

      const chunkSize = end - start + 1;
      await file.seek(start, Deno.SeekMode.Start);
      
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Content-Type", contentType);

      // Stream the file directly without artificial chunk limiting
      // The browser will handle the flow control and closing the stream if needed.
      return new Response(file.readable, {
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
