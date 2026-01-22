// file: data/repo/TukinRepository.kt
package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.TukinCalculationDto
import javax.inject.Inject

class TukinRepository @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore
) {
    suspend fun getCalculation(month: String): TukinCalculationDto? {
        val p = tokenStore.getProfile() ?: error("Session kosong, silakan login ulang")
        val res = api.tukinCalculations(
            month = month,
            satkerId = p.satkerId,
            userId = p.userId
        )
        if (res.status != "200") error(res.message ?: "Gagal memuat tukin")
        return res.data?.firstOrNull()
    }

    suspend fun generate(month: String, force: Boolean = true) {
        val p = tokenStore.getProfile() ?: error("Session kosong, silakan login ulang")
        val res = api.generateTukin(
            month = month,
            satkerId = p.satkerId,
            userId = p.userId,
            force = force
        )
        if (res.status != "200") error(res.message ?: "Generate gagal")
    }
}
