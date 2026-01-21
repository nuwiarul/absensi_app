package id.resta_pontianak.absensiapp.data.network

data class ChangeMyPasswordReq(
    val old_password: String,
    val password: String,
    val password_confirm: String
)
