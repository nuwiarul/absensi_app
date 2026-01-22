// file: data/repo/SettingsRepository.kt
package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.local.SettingsStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject

class SettingsRepository @Inject constructor(
    private val api: ApiService,
    private val store: SettingsStore,
) {
    private val mutex = Mutex()
    private var inFlight: Deferred<String>? = null

    suspend fun getTimezoneCached(ttlMs: Long = 5 * 60_000L): String {
        val now = System.currentTimeMillis()

        // 1) fast path: tanpa lock
        store.getTimezoneCached()?.let { cached ->
            if ((now - cached.fetchedAt) <= ttlMs && cached.timezone.isNotBlank()) {
                return cached.timezone
            }
        }

        // 2) single-flight: pastikan cuma 1 fetch yang jalan
        val job = mutex.withLock {
            // re-check setelah dapat lock (menghindari race)
            val now2 = System.currentTimeMillis()
            store.getTimezoneCached()?.let { cached ->
                if ((now2 - cached.fetchedAt) <= ttlMs && cached.timezone.isNotBlank()) {
                    return@withLock CompletableDeferred(cached.timezone)
                }
            }

            // kalau sudah ada fetch berjalan, join saja
            inFlight?.let { return@withLock it }

            // buat fetch baru (jalan di IO)
            CoroutineScope(Dispatchers.IO).async {
                try {
                    val res = api.getTimezone()
                    val tz = res.data?.timezone?.takeIf { it.isNotBlank() } ?: "Asia/Jakarta"
                    val fetchedAt = System.currentTimeMillis()
                    // simpan cache (boleh di IO)
                    store.saveTimezone(tz, fetchedAt)
                    tz
                } catch (_: Exception) {
                    // fallback kalau gagal
                    "Asia/Jakarta"
                }
            }.also { created ->
                inFlight = created
                created.invokeOnCompletion {
                    // bersihin inFlight saat selesai
                    CoroutineScope(Dispatchers.Default).launch {
                        mutex.withLock {
                            if (inFlight === created) inFlight = null
                        }
                    }
                }
            }
        }

        return job.await()
    }
}
