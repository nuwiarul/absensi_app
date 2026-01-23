package id.resta_pontianak.absensiapp.data.network

// ===== Announcements =====
data class AnnouncementDto(
    val id: String,
    val scope: String,
    val satker_id: String?,
    val satker_name: String?,
    val satker_code: String?,
    val title: String,
    val body: String,
    val is_active: Boolean,
    val created_by: String,
    val created_by_name: String,
    val created_at: String,
    val updated_at: String,
)