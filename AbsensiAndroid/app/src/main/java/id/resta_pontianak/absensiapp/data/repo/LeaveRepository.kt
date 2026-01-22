package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.network.*
import javax.inject.Inject

class LeaveRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun createLeave(req: LeaveCreateReq): LeaveCreateResp {
        // endpoint create bukan ApiResponse
        return try {
            val res = api.createLeave(req)
            // ✅ notify badge + screen lain
            LeaveEvents.emitChanged()
            res
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun pending(): List<LeavePendingDto> {
        return try {
            val res = api.leavePending()
            if (res.status != "200") {
                throw IllegalStateException("Gagal memuat pending (${res.status})")
            }
            res.data ?: emptyList()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun all(from: String, to: String, status: String? = null): List<LeaveListDto> {
        return try {
            val res = api.leaveAll(from, to, status)
            if (res.status != "200") {
                throw IllegalStateException("Gagal memuat data (${res.status})")
            }
            res.data ?: emptyList()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun mine(from: String, to: String, status: String? = null): List<LeaveListDto> {
        return try {
            val res = api.leaveMine(from, to, status)
            if (res.status != "200") {
                throw IllegalStateException("Gagal memuat data (${res.status})")
            }
            res.data ?: emptyList()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun cancel(id: String) {
        try {
            val res = api.cancelLeave(id)
            if (res.status != "200") {
                throw IllegalStateException("Batal ijin gagal (${res.status})")
            }
            LeaveEvents.emitChanged()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun approve(id: String, note: String) {
        try {
            val res = api.approveLeave(id, LeaveDecisionReq(note))
            if (res.status != "200") {
                throw IllegalStateException("Approve gagal (${res.status})")
            }
            LeaveEvents.emitChanged()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }

    suspend fun reject(id: String, note: String) {
        try {
            val res = api.rejectLeave(id, LeaveDecisionReq(note))
            if (res.status != "200") {
                throw IllegalStateException("Reject gagal (${res.status})")
            }
            LeaveEvents.emitChanged()
        } catch (e: Exception) {
            throw IllegalStateException(ApiErrorParser.parse(e))
        }
    }
}
