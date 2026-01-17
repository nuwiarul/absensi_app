package id.resta_pontianak.absensiapp.data.auth

sealed class AuthEvent {
    object Unauthorized : AuthEvent()
}