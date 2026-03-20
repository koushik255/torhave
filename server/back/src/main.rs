use axum::{
    body::Body,
    extract::{Path as PathParam, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use walkdir::WalkDir;

#[derive(Serialize)]
struct Movie {
    name: String,
    path: String,
}

#[derive(Clone)]
struct AppState {
    movies_dir: PathBuf,
}

#[derive(Deserialize)]
struct ClipRequest {
    /// Relative path under the movies directory (e.g. `Folder/video.mkv`).
    file: String,
    start: String,
    end: String,
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

/// Resolves a safe path to a video file under `movies_dir`.
fn movie_file(movies_dir: &Path, rel: &str) -> Result<PathBuf, &'static str> {
    if rel.is_empty() || rel.contains("..") {
        return Err("invalid file path");
    }
    let mut out = movies_dir.to_path_buf();
    for c in Path::new(rel).components() {
        match c {
            std::path::Component::Normal(os) => out.push(os),
            _ => return Err("invalid file path"),
        }
    }
    if !out.starts_with(movies_dir) {
        return Err("invalid file path");
    }
    match out
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("mp4") | Some("mkv") | Some("webm") => Ok(out),
        _ => Err("only mp4, mkv, webm"),
    }
}

/// `seconds`, `MM:SS`, or `HH:MM:SS` (fractions allowed on the last part).
fn parse_time(s: &str) -> Result<f64, &'static str> {
    let s = s.trim();
    if s.is_empty() {
        return Err("empty time");
    }
    if !s.contains(':') {
        return s.parse::<f64>().map_err(|_| "invalid number");
    }

    let p: Vec<&str> = s.split(':').collect();
    match p.len() {
        2 => {
            let m: f64 = p[0].parse().map_err(|_| "invalid time")?;
            let sec: f64 = p[1].parse().map_err(|_| "invalid time")?;
            Ok(m * 60.0 + sec)
        }
        3 => {
            let h: f64 = p[0].parse().map_err(|_| "invalid time")?;
            let m: f64 = p[1].parse().map_err(|_| "invalid time")?;
            let sec: f64 = p[2].parse().map_err(|_| "invalid time")?;
            Ok(h * 3600.0 + m * 60.0 + sec)
        }
        _ => Err("use seconds, MM:SS, or HH:MM:SS"),
    }
}

/// Builds a clip with ffmpeg, returns the `.mp4` bytes (temp file removed).
async fn post_clip(
    State(state): State<AppState>,
    Json(req): Json<ClipRequest>,
) -> Result<Response, (StatusCode, Json<ErrorBody>)> {
    let input = movie_file(&state.movies_dir, &req.file).map_err(|msg| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody { error: msg.into() }),
        )
    })?;

    if !tokio::fs::metadata(&input)
        .await
        .map(|m| m.is_file())
        .unwrap_or(false)
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: "file not found".into(),
            }),
        ));
    }

    let mut start = parse_time(&req.start).map_err(|msg| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: format!("start: {msg}"),
            }),
        )
    })?;
    start = start + 5.0;
    let end = parse_time(&req.end).map_err(|msg| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: format!("end: {msg}"),
            }),
        )
    })?;
    println!("Clip timing Start:{} End:{}", start, end);

    if end <= start {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: "end must be after start".into(),
            }),
        ));
    }

    let duration = end - start;
    let tmp = std::env::temp_dir().join(format!(
        "tor_clip_{}.mp4",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    let in_s = input.to_str().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorBody {
            error: "invalid path".into(),
        }),
    ))?;
    let tmp_s = tmp.to_str().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorBody {
            error: "invalid temp path".into(),
        }),
    ))?;

    let ss = format!("{start}");

    println!("Starting time for ffmpeg first {}", ss);
    let dur_s = format!("{duration}");
    let copy_ok = tokio::process::Command::new("ffmpeg")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-ss")
        .arg(&ss)
        .arg("-i")
        .arg(in_s)
        .arg("-t")
        .arg(&dur_s)
        .arg("-c")
        .arg("copy")
        .arg("-avoid_negative_ts")
        .arg("make_zero")
        .arg(tmp_s)
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);

    if !copy_ok {
        let _ = tokio::fs::remove_file(&tmp).await;
        let enc_ok = tokio::process::Command::new("ffmpeg")
            .arg("-hide_banner")
            .arg("-loglevel")
            .arg("error")
            .arg("-y")
            .arg("-ss")
            .arg(&ss)
            .arg("-i")
            .arg(in_s)
            .arg("-t")
            .arg(&dur_s)
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("fast")
            .arg("-crf")
            .arg("23")
            .arg("-c:a")
            .arg("aac")
            .arg("-movflags")
            .arg("+faststart")
            .arg(tmp_s)
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false);

        if !enc_ok {
            let _ = tokio::fs::remove_file(&tmp).await;
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorBody {
                    error: "ffmpeg failed".into(),
                }),
            ));
        }
    }

    let bytes = tokio::fs::read(&tmp).await.map_err(|_| {
        let _ = std::fs::remove_file(&tmp);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorBody {
                error: "read failed".into(),
            }),
        )
    })?;
    let _ = tokio::fs::remove_file(&tmp).await;

    let stem = Path::new(&req.file)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("clip");
    let filename = format!("{stem}_clip.mp4");

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(
            header::CONTENT_DISPOSITION,
            format!(r#"attachment; filename="{filename}""#),
        )
        .body(Body::from(bytes))
        .unwrap())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let movies_dir = PathBuf::from("/home/koushikk/Documents/anew/tor/movie");
    let state = AppState {
        movies_dir: movies_dir.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/movies", get(list_movies))
        .route("/api/clip", post(post_clip))
        .route("/subtitles/*path", get(serve_subtitle))
        .nest_service("/movie", ServeDir::new(movies_dir))
        .route("/:id", get(spa_watch))
        .fallback_service(ServeDir::new("dist"))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:8000";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("Server running on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}

async fn spa_watch(PathParam(id): PathParam<String>) -> Result<Response, StatusCode> {
    if id.contains("..") {
        return Err(StatusCode::NOT_FOUND);
    }

    if id.chars().all(|c| c.is_ascii_digit()) {
        let html = tokio::fs::read_to_string("dist/index.html")
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .body(Body::from(html))
            .unwrap());
    }

    let path = PathBuf::from("dist").join(&id);
    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    if !meta.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime.as_ref())
        .body(Body::from(bytes))
        .unwrap())
}

async fn list_movies(State(state): State<AppState>) -> Json<Vec<Movie>> {
    let mut movies = Vec::new();
    for entry in WalkDir::new(&state.movies_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str == "mp4" || ext_str == "mkv" || ext_str == "webm" {
                    if let Ok(rel_path) = path.strip_prefix(&state.movies_dir) {
                        movies.push(Movie {
                            name: entry.file_name().to_string_lossy().into_owned(),
                            path: rel_path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }
        }
    }
    Json(movies)
}

async fn serve_subtitle(
    State(state): State<AppState>,
    PathParam(path): PathParam<String>,
) -> Result<Response, StatusCode> {
    let srt_path = state.movies_dir.join(&path);

    let srt_content = match tokio::fs::read_to_string(&srt_path).await {
        Ok(content) => content,
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    let vtt_content = format!("WEBVTT\n\n{}", srt_content.replace(",", "."));

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/vtt; charset=utf-8")
        .body(Body::from(vtt_content))
        .unwrap())
}
