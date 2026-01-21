package id.resta_pontianak.absensiapp.data.network

data class UserMeResponse(
    val status: String? = null,
    val data: UserModel? = null
)


data class UserModel(
    val id: String,
    val satker: SatkerModel,
    val rank_id: String?,
    val rank: String?,
    val nrp: String,
    val full_name: String,
    val email: String?,
    val phone: String?,
    val profile_photo_key: String?,
    val role: String,
    val is_active: Boolean
)