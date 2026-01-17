package id.resta_pontianak.absensiapp.data.network

data class GeofenceModel(
    val id: String,
    val satker: SatkerModel,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val radius_meters: Int,
    val is_active: Boolean
)
