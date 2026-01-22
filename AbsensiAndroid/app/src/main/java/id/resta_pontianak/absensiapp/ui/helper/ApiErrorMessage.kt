package id.resta_pontianak.absensiapp.ui.helper

import retrofit2.HttpException
import java.io.IOException

fun apiErrorMessage(e: Throwable): String {
    return when (e) {
        is HttpException -> {
            val code = e.code()
            val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
            if (!body.isNullOrBlank()) body else "HTTP $code"
        }
        is IOException -> "Tidak bisa terhubung ke server"
        else -> e.message ?: "Terjadi kesalahan"
    }
}
