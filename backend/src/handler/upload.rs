use axum::{extract::Multipart, response::IntoResponse, Extension, Json, Router};
use chrono::{Datelike, Utc};
use std::{path::{PathBuf}, sync::Arc};
use axum::extract::DefaultBodyLimit;
use axum::routing::post;
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use crate::{AppState};
use crate::dtos::upload::{UploadSelfieData, UploadSelfieResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;

pub fn uploads_handler() -> Router {
    Router::new().route("/selfie", post(upload_selfie))
}

const MAX_BYTES: usize = 3 * 1024 * 1024; // 3MB

pub async fn upload_selfie(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    mut mp: Multipart,
) -> Result<impl IntoResponse, HttpError> {
    // folder: ./uploads/selfies/2026/01/16/
    let now = Utc::now();
    let date_path = format!("{:04}/{:02}/{:02}", now.year(), now.month(), now.day());

    let base_dir: PathBuf = app_state.upload_dir.join("selfies").join(date_path);
    fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // nama file aman + unik
    let file_id = Uuid::new_v4();
    let user_id = user_claims.user_claims.user_id;
    let filename = format!("{}_{}.jpg", user_id, file_id);
    let full_path = base_dir.join(&filename);

    // cari part bernama "file"
    let mut saved = false;

    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "file" {
            continue;
        }

        // validasi content-type kalau ada
        if let Some(ct) = field.content_type() {
            //let ct = ct.as_ref();
            let ok = ct == "image/jpeg" || ct == "image/jpg" || ct == "image/png";
            if !ok {
                return Err(HttpError::bad_request("file harus jpg/png".to_string()));
            }
        }

        let mut f = fs::File::create(&full_path)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut total: usize = 0;
        let mut field = field;

        // streaming write
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|e| HttpError::bad_request(e.to_string()))?
        {
            total += chunk.len();
            if total > MAX_BYTES {
                // hapus file yang sudah terbuat
                let _ = fs::remove_file(&full_path).await;
                return Err(HttpError::bad_request("file terlalu besar (max 3MB)".to_string()));
            }
            f.write_all(&chunk)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;
        }

        f.flush()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        saved = true;
        break;
    }

    if !saved {
        return Err(HttpError::bad_request("part file wajib".to_string()));
    }

    // object key internal (bukan URL publik)
    // contoh: local://selfies/2026/01/16/<filename>
    let rel = full_path
        .strip_prefix(&app_state.upload_dir)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .replace('\\', "/");

    let key = format!("local://{}", rel);

    Ok(Json(UploadSelfieResp {
        status: "200",
        data: UploadSelfieData {
            selfie_object_key: key,
        },
    }))
}
