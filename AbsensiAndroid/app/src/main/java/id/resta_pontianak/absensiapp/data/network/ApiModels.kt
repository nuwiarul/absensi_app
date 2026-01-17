package id.resta_pontianak.absensiapp.data.network

data class LoginReq(
    val username: String,
    val password: String
)

data class ApiResponse<T>(
    val status: String,
    val data: T?,
    val message: String? = null
)

data class LoginData(
    val id: String,
    val nrp: String,
    val full_name: String,
    val token: String,
    val satker_id: String,

    // ✅ NEW
    val role: String,
    val satker_name: String,
    val satker_code: String
)
