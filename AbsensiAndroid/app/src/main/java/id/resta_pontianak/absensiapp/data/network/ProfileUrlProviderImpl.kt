package id.resta_pontianak.absensiapp.data.network

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Named

class ProfileUrlProviderImpl @Inject constructor(
    @Named("ApiBaseUrl") private val baseUrl: String
) : ProfileUrlProvider {

    override fun build(objectKey: String): String {
        val base = baseUrl.trimEnd('/') // "http://10.0.2.2:8000/api"
        return "$base/files/profile?key=${
            URLEncoder.encode(objectKey, StandardCharsets.UTF_8.name())
        }"
    }
}
