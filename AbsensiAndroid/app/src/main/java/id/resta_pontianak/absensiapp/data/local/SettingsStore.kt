// file: data/local/SettingsStore.kt
package id.resta_pontianak.absensiapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore("app_settings")

class SettingsStore(private val ctx: Context) {
    private val KEY_TZ = stringPreferencesKey("timezone")
    private val KEY_TZ_FETCHED_AT = longPreferencesKey("timezone_fetched_at")

    suspend fun getTimezoneCached(): CachedTz? {
        val prefs = ctx.dataStore.data.first()
        val tz = prefs[KEY_TZ] ?: return null
        val at = prefs[KEY_TZ_FETCHED_AT] ?: 0L
        return CachedTz(tz, at)
    }

    suspend fun saveTimezone(tz: String, fetchedAt: Long) {
        ctx.dataStore.edit {
            it[KEY_TZ] = tz
            it[KEY_TZ_FETCHED_AT] = fetchedAt
        }
    }
}

data class CachedTz(
    val timezone: String,
    val fetchedAt: Long
)
