package id.resta_pontianak.absensiapp.data.network

interface ProfileUrlProvider {
    fun build(objectKey: String): String
}