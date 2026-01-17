package id.resta_pontianak.absensiapp.data.network

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class ClientChannelInterceptor @Inject constructor() : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request().newBuilder()
            .header("X-Client-Channel", "android")
            .build()
        return chain.proceed(req)
    }
}