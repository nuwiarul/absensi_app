// file: data/local/TukinStore.kt
package id.resta_pontianak.absensiapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore("tukin_cache")

class TukinStore(private val ctx: Context) {

    private fun keyLastGenerate(userId: String, month: String) =
        longPreferencesKey("tukin_last_generate_${userId}_$month")

    suspend fun getLastGenerateMs(userId: String, month: String): Long {
        val prefs = ctx.dataStore.data.first()
        return prefs[keyLastGenerate(userId, month)] ?: 0L
    }

    suspend fun setLastGenerateMs(userId: String, month: String, atMs: Long) {
        ctx.dataStore.edit { it[keyLastGenerate(userId, month)] = atMs }
    }
}
