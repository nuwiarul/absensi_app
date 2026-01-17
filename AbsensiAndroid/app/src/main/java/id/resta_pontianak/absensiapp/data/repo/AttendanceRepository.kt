package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.AttendanceReq
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionData
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionDto
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import javax.inject.Inject

class AttendanceRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun uploadSelfie(photoPath: String): String {
        val file = File(photoPath)
        val reqBody = file.asRequestBody("image/jpeg".toMediaType())
        val part = MultipartBody.Part.createFormData("file", file.name, reqBody)

        val res = api.uploadSelfie(part)
        return res.data?.selfie_object_key ?: error("Upload gagal (key kosong)")
    }

    suspend fun getChallengeId(): String {
        val res = api.attendanceChallenge()
        return res.data?.challenge_id ?: error("Challenge gagal")
    }

    suspend fun checkIn(req: AttendanceReq): AttendanceSessionData {
        val res = api.checkIn(req)
        return res.data ?: error("Check-in gagal")
    }


    suspend fun checkOut(req: AttendanceReq): AttendanceSessionData {
        val res = api.checkOut(req)
        return res.data ?: error("Check-out gagal")
    }

    suspend fun listAttendance(from: String, to: String): List<AttendanceSessionDto> {
        val res = api.attendanceList(from, to)

        if (res.status != "200") {
            error("Gagal memuat riwayat (status=${res.status})")
        }

        return res.data ?: emptyList()
    }


}