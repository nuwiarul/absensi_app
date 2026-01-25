package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.AttendanceApelDto
import javax.inject.Inject

class ApelRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun listApelHistory(from: String, to: String): List<AttendanceApelDto> {
        val res = api.apelHistory(from, to)

        if (res.status != "200") {
            error("Gagal memuat riwayat apel (status=${res.status})")
        }

        return res.data ?: emptyList()
    }
}
