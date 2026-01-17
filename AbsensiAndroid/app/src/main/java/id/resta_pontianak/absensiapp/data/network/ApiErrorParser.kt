package id.resta_pontianak.absensiapp.data.network

import com.google.gson.Gson
import retrofit2.HttpException

object ApiErrorParser {
    fun parse(e: Throwable): String {
        return if (e is HttpException) {
            try {
                val body = e.response()?.errorBody()?.string()
                if (body != null) {
                    val err = Gson().fromJson(body, ErrorResponse::class.java)
                    err.message ?: "Terjadi kesalahan (${e.code()})"
                } else {
                    "Terjadi kesalahan (${e.code()})"
                }
            } catch (ex: Exception) {
                "Terjadi kesalahan (${e.code()})"
            }
        } else {
            e.message ?: "Terjadi kesalahan tidak di ketahui"
        }
    }
}