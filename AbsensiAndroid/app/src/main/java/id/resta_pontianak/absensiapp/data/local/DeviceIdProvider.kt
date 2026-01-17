package id.resta_pontianak.absensiapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.util.UUID

private val Context.deviceDataStore by preferencesDataStore(name = "device_prefs")

class DeviceIdProvider (
    private val context: Context
) {
    private val KEY_DEVICE_ID = stringPreferencesKey("device_id")

    suspend fun getOrCreate(): String {
        val prefs = context.deviceDataStore.data.first()
        val existing = prefs[KEY_DEVICE_ID]
        if (!existing.isNullOrBlank()) return existing

        val newId = "ANDROID-" + UUID.randomUUID().toString()
        context.deviceDataStore.edit { it[KEY_DEVICE_ID] = newId }
        return newId
    }
}