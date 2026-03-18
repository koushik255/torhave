import { join, extname, basename } from "https://deno.land/std@0.224.0/path/mod.ts";

const MOVIES_DIR = "/home/koushikk/Documents/anew/tor/movie";

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

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS Headers
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Range",
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

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : size - 1;
        const chunkSize = end - start + 1;

        await file.seek(start, Deno.SeekMode.Start);
        
        headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Length", chunkSize.toString());
        headers.set("Content-Type", "video/x-matroska");

        return new Response(file.readable, {
          status: 206,
          headers,
        });
      }

      headers.set("Content-Length", size.toString());
      headers.set("Content-Type", "video/x-matroska");
      return new Response(file.readable, { headers });
    } catch (e) {
      return new Response("File not found", { status: 404, headers });
    }
  }

  return new Response("Not Found", { status: 404, headers });
});
