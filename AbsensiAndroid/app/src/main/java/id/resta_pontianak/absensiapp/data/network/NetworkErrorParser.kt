package id.resta_pontianak.absensiapp.data.network

import com.google.gson.Gson
import retrofit2.HttpException

fun Throwable.toUserMessage(gson: Gson = Gson()): String {
    if (this is HttpException) {
        val raw = this.response()?.errorBody()?.string()
        if (!raw.isNullOrBlank()) {
            return try {
                gson.fromJson(raw, ApiError::class.java).message ?: raw
            } catch (_: Throwable) {
                raw
            }
        }
        return "Server error (${code()})"
    }
    return message ?: "Terjadi kesalahan"
}