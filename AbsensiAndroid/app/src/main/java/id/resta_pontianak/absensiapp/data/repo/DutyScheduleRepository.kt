package id.resta_pontianak.absensiapp.data.repo

import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.CreateDutyScheduleReq
import id.resta_pontianak.absensiapp.data.network.DutyScheduleModels
import id.resta_pontianak.absensiapp.data.network.DutyScheduleRequestDto
import id.resta_pontianak.absensiapp.data.network.RejectDutyScheduleRequestReq
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DutyScheduleRepository @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore
) {
    suspend fun listDutySchedules(from: String, to: String): List<DutyScheduleModels> {
        val profile = tokenStore.getProfile() ?: return emptyList()
        return api.listDutySchedules(
            from = from,
            to = to,
            satkerId = profile.satkerId,
            userId = profile.userId
        ).data ?: emptyList()
    }

    suspend fun listDutyScheduleRequests(status: String, from: String?, to: String?): List<DutyScheduleRequestDto> {
        return api.listDutyScheduleRequests(
            status = status,
            from = from,
            to = to
        ).data ?: emptyList()
    }

    suspend fun createDutyScheduleRequest(req: CreateDutyScheduleReq): String {
        return api.createDutyScheduleRequest(req).data ?: "OK"
    }

    suspend fun cancelDutyScheduleRequest(id: String): String {
        return api.cancelDutyScheduleRequest(id).data ?: "OK"
    }

    suspend fun approveDutyScheduleRequest(id: String): String {
        return api.approveDutyScheduleRequest(id).data ?: "OK"
    }

    suspend fun rejectDutyScheduleRequest(id: String, reason: String): String {
        return api.rejectDutyScheduleRequest(id,
            RejectDutyScheduleRequestReq(reject_reason = reason)
        ).data ?: "OK"
    }
}
