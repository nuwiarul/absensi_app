use std::sync::LazyLock;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::auth::rbac::UserRole;
use crate::error::{ErrorMessage, HttpError};

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String, // Subject (user_id)
    pub iat: usize, // Issued At (timestamp)
    pub exp: usize, // Expires At (timestamp)
}

//Constant for default token configuration
const DEFAULT_ALGORITHM: Algorithm = Algorithm::HS256;
static DEFAULT_TOKEN_VALIDATION: LazyLock<Validation> = LazyLock::new(|| Validation::new(DEFAULT_ALGORITHM));

static HEADER: LazyLock<Header> = LazyLock::new(|| Header::new(DEFAULT_ALGORITHM));

pub fn create_token(
    user_id: &str,
    secret: &[u8],
    expires_in_seconds: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    if user_id.is_empty() {
        return Err(jsonwebtoken::errors::ErrorKind::InvalidSubject.into());
    }


    let now = Utc::now();


    let claims = TokenClaims {
        sub: user_id.to_string(),
        iat: now.timestamp() as usize,
        exp: (now + Duration::seconds(expires_in_seconds)).timestamp() as usize,
    };

    //use a static header to avoid reconstruction
    encode(&HEADER, &claims, &EncodingKey::from_secret(secret))

}

pub fn decode_token(
    token: &str,
    secret: &[u8],
) -> Result<String, HttpError> {
    let decoded = decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(secret),
        &DEFAULT_TOKEN_VALIDATION,
    );

    match decoded {
        Ok(token_data) => Ok(token_data.claims.sub),
        Err(_) => Err(HttpError::unauthorized(ErrorMessage::InvalidToken.to_string()))
    }
}