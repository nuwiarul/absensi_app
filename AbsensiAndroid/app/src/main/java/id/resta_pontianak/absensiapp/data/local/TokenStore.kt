package id.resta_pontianak.absensiapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore("auth")

class TokenStore(private val ctx: Context) {
    private val KEY_TOKEN = stringPreferencesKey("token")
    private val KEY_NRP = stringPreferencesKey("nrp")
    private val KEY_FULLNAME = stringPreferencesKey("full_name")
    private val KEY_SATKER = stringPreferencesKey("satker_id")
    private val KEY_USER_ID = stringPreferencesKey("user_id")

    // ✅ NEW
    private val KEY_ROLE = stringPreferencesKey("role")
    private val KEY_SATKER_NAME = stringPreferencesKey("satker_name")
    private val KEY_SATKER_CODE = stringPreferencesKey("satker_code")

    suspend fun saveSession(
        token: String,
        userId: String,
        nrp: String,
        fullName: String,
        satkerId: String,

        // ✅ NEW
        role: String,
        satkerName: String,
        satkerCode: String
    ) {
        ctx.dataStore.edit {
            it[KEY_TOKEN] = token
            it[KEY_USER_ID] = userId
            it[KEY_NRP] = nrp
            it[KEY_FULLNAME] = fullName
            it[KEY_SATKER] = satkerId

            // ✅ NEW
            it[KEY_ROLE] = role
            it[KEY_SATKER_NAME] = satkerName
            it[KEY_SATKER_CODE] = satkerCode
        }
    }

    suspend fun getToken(): String? {
        val prefs = ctx.dataStore.data.first()
        return prefs[KEY_TOKEN]
    }

    suspend fun getProfile(): LocalProfile? {
        val prefs = ctx.dataStore.data.first()
        val uid = prefs[KEY_USER_ID] ?: return null
        val nrp = prefs[KEY_NRP] ?: return null
        val name = prefs[KEY_FULLNAME] ?: return null
        val satker = prefs[KEY_SATKER] ?: return null

        // ✅ NEW (boleh null kalau user lama belum punya data tersimpan)
        val role = prefs[KEY_ROLE]
        val satkerName = prefs[KEY_SATKER_NAME]
        val satkerCode = prefs[KEY_SATKER_CODE]

        return LocalProfile(
            uid, nrp, name, satker,
            role = role,
            satkerName = satkerName,
            satkerCode = satkerCode
        )
    }

    suspend fun clear() {
        ctx.dataStore.edit {
            it.remove(KEY_TOKEN)
            it.remove(KEY_USER_ID)
            it.remove(KEY_NRP)
            it.remove(KEY_FULLNAME)
            it.remove(KEY_SATKER)

            // ✅ NEW
            it.remove(KEY_ROLE)
            it.remove(KEY_SATKER_NAME)
            it.remove(KEY_SATKER_CODE)
        }
    }
}

data class LocalProfile(
    val userId: String,
    val nrp: String,
    val fullName: String,
    val satkerId: String,

    // ✅ NEW (nullable biar backward compatible)
    val role: String?,
    val satkerName: String?,
    val satkerCode: String?
)