package id.resta_pontianak.absensiapp.data.network

import id.resta_pontianak.absensiapp.data.auth.AuthEvent
import id.resta_pontianak.absensiapp.data.auth.AuthEventBus
import id.resta_pontianak.absensiapp.data.local.TokenStore
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor (
    private val tokenStore: TokenStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        // Ambil token dari DataStore (suspend), di-okhttp pakai runBlocking (aman untuk request kecil)
        val token = runBlocking { tokenStore.getToken() }

       /* // Kalau token kosong, kirim request biasa
        if (token.isNullOrBlank()) {
            return chain.proceed(original)
        }

        // Tambahkan Authorization
        val newReq = original.newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()*/



        //return chain.proceed(newReq)

        val request = if (!token.isNullOrBlank()) {
            original.newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }

        val response = chain.proceed(request)

        // 🔥 AUTO LOGOUT JIKA TOKEN INVALID / EXPIRED
        if (response.code == 401 || response.code == 403) {
            AuthEventBus.emit(AuthEvent.Unauthorized)
        }

        return response

    }
}