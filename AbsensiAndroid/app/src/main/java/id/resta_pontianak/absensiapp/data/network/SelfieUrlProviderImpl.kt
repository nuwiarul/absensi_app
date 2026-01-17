package id.resta_pontianak.absensiapp.data.network

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Named

class SelfieUrlProviderImpl @Inject constructor(
    @Named("ApiBaseUrl") private val baseUrl: String
) : SelfieUrlProvider {

    override fun build(objectKey: String): String {
        val base = baseUrl.trimEnd('/') // "http://10.0.2.2:8000/api"
        return "$base/files/selfie?key=${
            URLEncoder.encode(objectKey, StandardCharsets.UTF_8.name())
        }"
    }
}