package id.resta_pontianak.absensiapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

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

    private val KEY_PROFILE_PHOTO_KEY = stringPreferencesKey("profile_photo_key")

    private val KEY_PHONE = stringPreferencesKey("phone")

    suspend fun saveSession(
        token: String,
        userId: String,
        nrp: String,
        fullName: String,
        satkerId: String,

        // ✅ NEW
        role: String,
        satkerName: String,
        satkerCode: String,
        profilePhotoKey: String?
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

            if (!profilePhotoKey.isNullOrBlank()) {
                it[KEY_PROFILE_PHOTO_KEY] = profilePhotoKey
            } else {
                it.remove(KEY_PROFILE_PHOTO_KEY)
            }
        }
    }

    suspend fun getToken(): String? {
        val prefs = ctx.dataStore.data.first()
        return prefs[KEY_TOKEN]
    }

    suspend fun setFullName(fullName: String) {
        ctx.dataStore.edit { it[KEY_FULLNAME] = fullName }
    }

    // ✅ ADD (opsional)
    suspend fun setPhone(phone: String?) {
        ctx.dataStore.edit {
            if (phone.isNullOrBlank()) it.remove(KEY_PHONE) else it[KEY_PHONE] = phone
        }
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

        val photoKey = prefs[KEY_PROFILE_PHOTO_KEY] // ✅ NEW

        return LocalProfile(
            uid, nrp, name, satker,
            role = role,
            satkerName = satkerName,
            satkerCode = satkerCode,
            profilePhotoKey = photoKey
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

            it.remove(KEY_PROFILE_PHOTO_KEY)
        }
    }

    suspend fun setProfilePhotoKey(key: String?) {
        ctx.dataStore.edit {
            if (!key.isNullOrBlank()) it[KEY_PROFILE_PHOTO_KEY] = key
            else it.remove(KEY_PROFILE_PHOTO_KEY)
        }
    }

    val profileFlow: Flow<LocalProfile?> = ctx.dataStore.data
        .map { prefs ->
            val uid = prefs[KEY_USER_ID] ?: return@map null
            val nrp = prefs[KEY_NRP] ?: return@map null
            val name = prefs[KEY_FULLNAME] ?: return@map null
            val satker = prefs[KEY_SATKER] ?: return@map null

            LocalProfile(
                userId = uid,
                nrp = nrp,
                fullName = name,
                satkerId = satker,
                role = prefs[KEY_ROLE],
                satkerName = prefs[KEY_SATKER_NAME],
                satkerCode = prefs[KEY_SATKER_CODE],
                profilePhotoKey = prefs[KEY_PROFILE_PHOTO_KEY]
            )
        }
        // penting supaya tidak spam refresh kalau value sama
        .distinctUntilChanged()

    data class SessionKey(val userId: String?, val role: String?, val satkerId: String?)

    val sessionKeyFlow: Flow<SessionKey> = ctx.dataStore.data
        .map { prefs ->
            SessionKey(
                userId = prefs[KEY_USER_ID],
                role = prefs[KEY_ROLE],
                satkerId = prefs[KEY_SATKER]

            )
        }
        .distinctUntilChanged()
}

data class LocalProfile(
    val userId: String,
    val nrp: String,
    val fullName: String,
    val satkerId: String,

    // ✅ NEW (nullable biar backward compatible)
    val role: String?,
    val satkerName: String?,
    val satkerCode: String?,
    val profilePhotoKey: String?
)