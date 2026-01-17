use std::sync::LazyLock;

use argon2::{Algorithm, Argon2, Params, Version};
use argon2::password_hash::{Error as PasswordHashError, SaltString, rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier};
use crate::error::ErrorMessage;

const MAX_PASSWORD_LENGTH: usize = 64;
const MIN_PASSWORD_LENGTH: usize = 8;

// Optimized Argon2 parameters best security/ speed balance
static ARGON2: LazyLock<Argon2<'static>> = LazyLock::new(|| {
    let params = Params::new(
        4_096, // 4MB memory - lower then default but still secure
        3, // iterations - higher the default but secure
        1, // lanes - higher then default
        Some(32) // parallelism - higher then default but still secure
    ).expect("Error creating Argon2 Params");
    Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        params
    )
});

pub fn hash_password<T>(password: T) -> Result<String, ErrorMessage>
where
    T: AsRef<[u8]>
{
    let password = password.as_ref();
    if password.is_empty() {
        return Err(ErrorMessage::EmptyPassword)
    }

    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(ErrorMessage::PasswordsTooShort(MIN_PASSWORD_LENGTH))
    }

    if password.len() > MAX_PASSWORD_LENGTH {
        return Err(ErrorMessage::ExceededMaxPasswordLength(MAX_PASSWORD_LENGTH))
    }

    let salt = SaltString::generate(&mut OsRng);

    let hash =
        ARGON2
            .hash_password(password, &salt)
            .map_err(|e| match e {
                PasswordHashError::Password => ErrorMessage::HashingError,
                _ => ErrorMessage::HashingError
            })?;
    Ok(hash.to_string())


}

pub fn compare_password<T>(password: T, hash_password: &str) -> Result<bool, ErrorMessage>
where
    T: AsRef<[u8]>{
    let password = password.as_ref();
    if password.is_empty() {
        return Err(ErrorMessage::EmptyPassword)
    }

    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(ErrorMessage::PasswordsTooShort(MIN_PASSWORD_LENGTH))
    }

    if password.len() > MAX_PASSWORD_LENGTH {
        return Err(ErrorMessage::ExceededMaxPasswordLength(MAX_PASSWORD_LENGTH))
    }

    let parsed_hash = PasswordHash::new(hash_password)
        .map_err(|_| ErrorMessage::InvalidHashFormat)?;
    match ARGON2.verify_password(password, &parsed_hash) {
        Ok(_) => Ok(true),
        Err(PasswordHashError::Password) => Ok(false),
        Err(_) => Err(ErrorMessage::HashingError)
    }
}