package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.LoginReq

class AuthRepository(
    private val api: ApiService,
    private val tokenStore: TokenStore
) {
    suspend fun login(
        username: String,
        password: String,
    ) : Result<Unit> {
       /* return runCatching {
            val res = api.login(LoginReq(username = username, password = password))
            val data = res.data ?: error("Response data kosong")
            tokenStore.saveSession(
                token = data.token,
                userId = data.id,
                nrp = data.nrp,
                fullName = data.full_name,
                satkerId = data.satker_id
            )
        }*/
        return try {
            val res = api.login(LoginReq(username = username, password = password))
            val data = res.data ?: error("Response data kosong")
            tokenStore.saveSession(
                token = data.token,
                userId = data.id,
                nrp = data.nrp,
                fullName = data.full_name,
                satkerId = data.satker_id,
                // ✅ NEW
                role = data.role,
                satkerName = data.satker_name,
                satkerCode = data.satker_code,
                profilePhotoKey = data.profile_photo_key
            )
            Result.success(Unit)
        } catch (e: Throwable) {
            val msg = ApiErrorParser.parse(e)
            Result.failure(Exception(msg))
        }
    }
}