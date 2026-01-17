package id.resta_pontianak.absensiapp.data.network

interface SelfieUrlProvider {
    fun build(objectKey: String): String
}