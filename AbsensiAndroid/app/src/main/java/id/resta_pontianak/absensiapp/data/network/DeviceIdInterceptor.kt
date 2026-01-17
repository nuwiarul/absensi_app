package id.resta_pontianak.absensiapp.data.network

import id.resta_pontianak.absensiapp.data.local.DeviceIdProvider
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class DeviceIdInterceptor(
    private val deviceIdProvider: DeviceIdProvider
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()

        // Device ID dari DataStore (suspend) -> pakai runBlocking sekali di interceptor
        val deviceId = runBlocking { deviceIdProvider.getOrCreate() }

        val newReq = req.newBuilder()
            .header("X-Device-Id", deviceId)
            .build()

        return chain.proceed(newReq)
    }
}