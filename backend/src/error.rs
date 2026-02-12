use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: String,
    pub message: String,
}

impl fmt::Display for ErrorResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", serde_json::to_string(&self).unwrap())
    }
}

#[derive(Debug, PartialEq)]
pub enum ErrorMessage {
    EmptyPassword,
    ExceededMaxPasswordLength(usize),
    PasswordsTooShort(usize),
    InvalidHashFormat,
    HashingError,
    InvalidToken,
    ServerError,
    WrongCredentials,
    EmailAlreadyExists,
    UserNoLongerExists,
    SatkerNoLonger,
    TokenNotProvided,
    PermissionDenied,
    ForbiddenRequest,
}

impl ToString for ErrorMessage {
    fn to_string(&self) -> String {
        self.to_str().to_owned()
    }
}

impl ErrorMessage {
    fn to_str(&self) -> String {
        match self {
            ErrorMessage::EmptyPassword => "Password cannot be empty.".to_string(),
            ErrorMessage::ExceededMaxPasswordLength(max) => {
                format!("Password cannot exceed {} characters.", max)
            }
            ErrorMessage::PasswordsTooShort(min) => {
                format!("Password must be at least {} characters long.", min)
            }
            ErrorMessage::InvalidHashFormat => "The provided hash format is invalid.".to_string(),
            ErrorMessage::HashingError => {
                "An error occurred while hashing the password.".to_string()
            }
            ErrorMessage::InvalidToken => {
                "The provided token is invalid or has expired.".to_string()
            }
            ErrorMessage::ServerError => "An internal server error occurred.".to_string(),
            ErrorMessage::WrongCredentials => "The provided credentials are incorrect.".to_string(),
            ErrorMessage::EmailAlreadyExists => {
                "An account with this email already exists.".to_string()
            }
            ErrorMessage::UserNoLongerExists => "The user account no longer exists.".to_string(),
            ErrorMessage::SatkerNoLonger => "Satker not longer exists.".to_string(),
            ErrorMessage::ForbiddenRequest => {
                "Forbidden, anda tidak berhak mengakses request ini.".to_string()
            }
            ErrorMessage::TokenNotProvided => "Authentication token was not provided.".to_string(),
            ErrorMessage::PermissionDenied => {
                "You do not have permission to perform this action.".to_string()
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct HttpError {
    pub message: String,
    pub status: StatusCode,
}

impl HttpError {
    pub fn new<T>(message: T, status: StatusCode) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status,
        }
    }

    pub fn server_error<T>(message: T) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn bad_request<T>(message: T) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status: StatusCode::BAD_REQUEST,
        }
    }

    pub fn unauthorized<T>(message: T) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status: StatusCode::UNAUTHORIZED,
        }
    }

    pub fn unique_constraint_violation<T>(message: T) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status: StatusCode::CONFLICT,
        }
    }

    pub fn too_many_requests<T>(message: T) -> Self
    where
        T: Into<String>,
    {
        Self {
            message: message.into(),
            status: StatusCode::TOO_MANY_REQUESTS,
        }
    }

    pub fn into_http_response(self) -> Response {
        let json_response = Json(ErrorResponse {
            message: self.message,
            status: self.status.to_string(),
        });
        (self.status, json_response).into_response()
    }
}

impl fmt::Display for HttpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "HttpError: message: {}, status: {}",
            self.message, self.status
        )
    }
}

impl std::error::Error for HttpError {}

impl IntoResponse for HttpError {
    fn into_response(self) -> Response {
        self.into_http_response()
    }
}
