use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct UploadSelfieData {
    pub selfie_object_key: String,
}

#[derive(Debug, Serialize)]
pub struct UploadSelfieResp {
    pub status: &'static str,
    pub data: UploadSelfieData,
}
