use axum::extract::Multipart;
use chrono::{Datelike, Utc};
use std::path::{Path, PathBuf};
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use crate::error::HttpError;

const FILE_FIELD_NAME: &str = "file";
const SELFIE_MAX_BYTES: usize = 3 * 1024 * 1024; // 3MB
const PROFILE_PHOTO_MAX_BYTES: usize = 2 * 1024 * 1024; // 2MB

const IMAGE_CONTENT_TYPES: [&str; 3] = ["image/jpeg", "image/jpg", "image/png"];

enum ExtensionPolicy {
    Fixed(&'static str),
    PngOrJpeg {
        default_ext: &'static str,
        png_ext: &'static str,
    },
}

pub async fn save_selfie_upload(
    upload_dir: &Path,
    user_id: Uuid,
    mp: Multipart,
) -> Result<String, HttpError> {
    save_image_upload(
        upload_dir,
        "selfies",
        user_id,
        mp,
        SELFIE_MAX_BYTES,
        ExtensionPolicy::Fixed("jpg"),
    )
    .await
}

pub async fn save_profile_photo_upload(
    upload_dir: &Path,
    user_id: Uuid,
    mp: Multipart,
) -> Result<String, HttpError> {
    save_image_upload(
        upload_dir,
        "profiles",
        user_id,
        mp,
        PROFILE_PHOTO_MAX_BYTES,
        ExtensionPolicy::PngOrJpeg {
            default_ext: "jpg",
            png_ext: "png",
        },
    )
    .await
}

async fn save_image_upload(
    upload_dir: &Path,
    folder: &str,
    user_id: Uuid,
    mut mp: Multipart,
    max_bytes: usize,
    ext_policy: ExtensionPolicy,
) -> Result<String, HttpError> {
    let now = Utc::now();
    let date_path = format!("{:04}/{:02}/{:02}", now.year(), now.month(), now.day());
    let base_dir: PathBuf = upload_dir.join(folder).join(date_path);

    fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let file_id = Uuid::new_v4();

    let mut saved_path: Option<PathBuf> = None;

    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != FILE_FIELD_NAME {
            continue;
        }

        let content_type = field.content_type();
        if let Some(ct) = content_type {
            let ok = IMAGE_CONTENT_TYPES.contains(&ct);
            if !ok {
                return Err(HttpError::bad_request("file harus jpg/png".to_string()));
            }
        }

        let ext = match &ext_policy {
            ExtensionPolicy::Fixed(ext) => *ext,
            ExtensionPolicy::PngOrJpeg {
                default_ext,
                png_ext,
            } => {
                if content_type == Some("image/png") {
                    *png_ext
                } else {
                    *default_ext
                }
            }
        };

        let filename = format!("{}_{}.{}", user_id, file_id, ext);
        let full_path = base_dir.join(&filename);

        let mut f = fs::File::create(&full_path)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut total: usize = 0;
        let mut field = field;
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|e| HttpError::bad_request(e.to_string()))?
        {
            total += chunk.len();
            if total > max_bytes {
                let _ = fs::remove_file(&full_path).await;
                return Err(HttpError::bad_request(format!(
                    "file terlalu besar (max {}MB)",
                    max_bytes / (1024 * 1024)
                )));
            }
            f.write_all(&chunk)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;
        }

        f.flush()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        saved_path = Some(full_path);
        break;
    }

    let full_path = saved_path.ok_or(HttpError::bad_request("part file wajib".to_string()))?;

    let rel = full_path
        .strip_prefix(upload_dir)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .replace('\\', "/");

    Ok(format!("local://{}", rel))
}
