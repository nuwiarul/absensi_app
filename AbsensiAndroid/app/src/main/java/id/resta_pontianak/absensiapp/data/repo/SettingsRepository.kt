// file: data/repo/SettingsRepository.kt
package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.local.SettingsStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject

class SettingsRepository @Inject constructor(
    private val api: ApiService,
    private val store: SettingsStore
) {
    private val mutex = Mutex()

    suspend fun getTimezoneCached(ttlMs: Long = 5 * 60_000L): String {
        return mutex.withLock {
            val now = System.currentTimeMillis()
            val cached = store.getTimezoneCached()
            if (cached != null && (now - cached.fetchedAt) <= ttlMs && cached.timezone.isNotBlank()) {
                return cached.timezone
            }

            val res = api.getTimezone()
            val tz = res.data?.timezone ?: "Asia/Jakarta"
            store.saveTimezone(tz, now)
            tz
        }
    }
}
