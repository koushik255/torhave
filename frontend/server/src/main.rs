use axum::{
    extract::State,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::path::PathBuf;
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

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let movies_dir = PathBuf::from("/root/tormov/torhave/movie");
    let state = AppState { movies_dir: movies_dir.clone() };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/movies", get(list_movies))
        .nest_service("/movies", ServeDir::new(movies_dir))
        .fallback_service(ServeDir::new("../dist"))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:8000";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("Server running on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
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
