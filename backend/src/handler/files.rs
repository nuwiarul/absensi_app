use axum::{extract::Query, http::{header, HeaderValue, StatusCode}, response::{IntoResponse, Response}, Extension, Router};
use std::{path::{Path, PathBuf}, sync::Arc};
use axum::routing::{get, post};
use tokio::fs;


use crate::{AppState};
use crate::error::HttpError;
use crate::handler::upload::upload_selfie;
use crate::middleware::auth_middleware::AuthMiddleware;

#[derive(Debug, serde::Deserialize)]
pub struct SelfieQuery {
    pub key: String,
}

pub fn files_handler() -> Router {
    Router::new()
        .route("/selfie", get(get_selfie_file))
        .route("/profile", get(get_profile_file))
}

// GET /api/files/selfie?key=local://selfies/2026/01/16/xxx.jpg
pub async fn get_selfie_file(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>, // auth wajib
    Query(q): Query<SelfieQuery>,
) -> Result<Response, HttpError> {
    // 1) validasi skema key
    // hanya izinkan local://selfies/...
    let prefix = "local://selfies/";
    if !q.key.starts_with(prefix) {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    // 2) ambil path relatif setelah prefix
    let rel = &q.key[prefix.len()..]; // contoh: 2026/01/16/file.jpg

    // blokir path traversal sederhana
    if rel.contains("..") || rel.contains('\\') {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    // 3) buat full path: upload_dir/selfies/<rel>
    let selfies_root: PathBuf = app_state.upload_dir.join("selfies");
    let full_path = selfies_root.join(rel);

    // 4) canonicalize untuk memastikan masih di dalam folder selfies_root
    // catatan: canonicalize butuh file ada. kalau file tidak ada => NotFound
    let canon_root = fs::canonicalize(&selfies_root)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let canon_file = match fs::canonicalize(&full_path).await {
        Ok(p) => p,
        Err(_) => return Err(HttpError::bad_request("file tidak ditemukan".to_string())),
    };

    if !canon_file.starts_with(&canon_root) {
        return Err(HttpError::bad_request("akses file ditolak".to_string()));
    }

    // 5) read file bytes
    let bytes = fs::read(&canon_file)
        .await
        .map_err(|_| HttpError::bad_request("file tidak ditemukan".to_string()))?;


    let mime = mime_guess::from_path(&canon_file).first_or_octet_stream();

    // kalau tidak pakai mime_guess, hardcode jpg:
    // let mime = mime::IMAGE_JPEG;

    let mut resp = (StatusCode::OK, bytes).into_response();

    // set content-type
    let ct = mime.to_string();
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&ct).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );

    // inline supaya bisa ditampilkan di browser / webview
    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("inline"),
    );

    Ok(resp)
}

// GET /api/files/profile?key=local://profiles/2026/01/16/xxx.jpg
pub async fn get_profile_file(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
    Query(q): Query<SelfieQuery>,
) -> Result<Response, HttpError> {
    let prefix = "local://profiles/";
    if !q.key.starts_with(prefix) {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    let rel = &q.key[prefix.len()..];
    if rel.contains("..") || rel.contains('\\') {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    let profiles_root: PathBuf = app_state.upload_dir.join("profiles");
    let full_path = profiles_root.join(rel);

    let canon_root = fs::canonicalize(&profiles_root)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let canon_file = match fs::canonicalize(&full_path).await {
        Ok(p) => p,
        Err(_) => return Err(HttpError::bad_request("file tidak ditemukan".to_string())),
    };

    if !canon_file.starts_with(&canon_root) {
        return Err(HttpError::bad_request("akses file ditolak".to_string()));
    }

    let bytes = fs::read(&canon_file)
        .await
        .map_err(|_| HttpError::bad_request("file tidak ditemukan".to_string()))?;

    let mime = mime_guess::from_path(&canon_file).first_or_octet_stream();
    let mut resp = (StatusCode::OK, bytes).into_response();

    let ct = mime.to_string();
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&ct).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );

    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("inline"),
    );

    Ok(resp)
}



/*use axum::{extract::Query, http::{header, HeaderValue, StatusCode}, response::{IntoResponse, Response}, Extension, Router};
use std::{path::{Path, PathBuf}, sync::Arc};
use axum::routing::{get, post};
use tokio::fs;


use crate::{AppState};
use crate::error::HttpError;
use crate::handler::upload::upload_selfie;
use crate::middleware::auth_middleware::AuthMiddleware;

#[derive(Debug, serde::Deserialize)]
pub struct SelfieQuery {
    pub key: String,
}

pub fn files_handler() -> Router {
    Router::new().route("/selfie", get(get_selfie_file))
}

// GET /api/files/selfie?key=local://selfies/2026/01/16/xxx.jpg
pub async fn get_selfie_file(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>, // auth wajib
    Query(q): Query<SelfieQuery>,
) -> Result<Response, HttpError> {
    // 1) validasi skema key
    // hanya izinkan local://selfies/...
    let prefix = "local://selfies/";
    if !q.key.starts_with(prefix) {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    // 2) ambil path relatif setelah prefix
    let rel = &q.key[prefix.len()..]; // contoh: 2026/01/16/file.jpg

    // blokir path traversal sederhana
    if rel.contains("..") || rel.contains('\\') {
        return Err(HttpError::bad_request("key tidak valid".to_string()));
    }

    // 3) buat full path: upload_dir/selfies/<rel>
    let selfies_root: PathBuf = app_state.upload_dir.join("selfies");
    let full_path = selfies_root.join(rel);

    // 4) canonicalize untuk memastikan masih di dalam folder selfies_root
    // catatan: canonicalize butuh file ada. kalau file tidak ada => NotFound
    let canon_root = fs::canonicalize(&selfies_root)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let canon_file = match fs::canonicalize(&full_path).await {
        Ok(p) => p,
        Err(_) => return Err(HttpError::bad_request("file tidak ditemukan".to_string())),
    };

    if !canon_file.starts_with(&canon_root) {
        return Err(HttpError::bad_request("akses file ditolak".to_string()));
    }

    // 5) read file bytes
    let bytes = fs::read(&canon_file)
        .await
        .map_err(|_| HttpError::bad_request("file tidak ditemukan".to_string()))?;


    let mime = mime_guess::from_path(&canon_file).first_or_octet_stream();

    // kalau tidak pakai mime_guess, hardcode jpg:
    // let mime = mime::IMAGE_JPEG;

    let mut resp = (StatusCode::OK, bytes).into_response();

    // set content-type
    let ct = mime.to_string();
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&ct).unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );

    // inline supaya bisa ditampilkan di browser / webview
    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("inline"),
    );

    Ok(resp)
}
*/