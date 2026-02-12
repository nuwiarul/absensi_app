use crate::auth::rbac::UserRole;
use axum::http::HeaderMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientChannel {
    Android,
    Ios,
    Web,
    Api,
}

impl ClientChannel {
    pub fn from_headers(headers: &HeaderMap) -> ClientChannel {
        // Default: API (Postman/Insomnia) agar tetap bisa login tanpa set header
        let raw = headers
            .get("x-client-channel")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("api")
            .to_ascii_lowercase();

        match raw.as_str() {
            "android" => ClientChannel::Android,
            "ios" => ClientChannel::Ios,
            "web" => ClientChannel::Web,
            "api" => ClientChannel::Api,
            _ => ClientChannel::Api,
        }
    }
}

pub fn is_login_allowed(role: UserRole, channel: ClientChannel) -> bool {
    use ClientChannel::*;
    use UserRole::*;

    match role {
        // Superadmin & SatkerAdmin: tidak boleh login dari Android/iOS app
        Superadmin | SatkerAdmin => !matches!(channel, Android | Ios),

        // SatkerHead & Member: tidak boleh login dari Web browser
        SatkerHead | Member => !matches!(channel, Web),
    }
}
