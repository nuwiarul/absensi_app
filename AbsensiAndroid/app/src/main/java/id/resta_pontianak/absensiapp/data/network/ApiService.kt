package id.resta_pontianak.absensiapp.data.network

import com.google.gson.JsonElement
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("auth/login")
    suspend fun login(@Body req: LoginReq): ApiResponse<LoginData>

    @GET("geofences")
    suspend fun geofences(): ApiResponse<List<GeofenceModel>>

    @Multipart
    @POST("uploads/selfie")
    suspend fun uploadSelfie(
        @Part file: MultipartBody.Part
    ): ApiResponse<UploadSelfieData>

    @POST("attendance-challenge")
    suspend fun attendanceChallenge(): ApiResponse<AttendanceChallengeData>

    @POST("attendance/check-in")
    suspend fun checkIn(@Body req: AttendanceReq): ApiResponse<AttendanceSessionData>

    @POST("attendance/check-out")
    suspend fun checkOut(@Body req: AttendanceReq): ApiResponse<AttendanceSessionData>

    @GET("attendance/get")
    suspend fun getAttendanceToday(): AttendanceGetResp

    @GET("attendance/list")
    suspend fun attendanceList(
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<AttendanceSessionDto>>

    // ===== Working days (calendar) =====
    @GET("working-days")
    suspend fun workingDays(
        @Query("satker_id") satkerId: String,
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<WorkingDayDto>>

    // ===== Duty schedules =====
    // NOTE: backend akan force satker_id sesuai satker user untuk non-superadmin
    @GET("duty-schedules")
    suspend fun dutySchedules(
        @Query("from") fromIso: String,
        @Query("to") toIso: String,
        @Query("user_id") userId: String
    ): ApiResponse<List<DutyScheduleDto>>

    @POST("leave-requests/create")
    suspend fun createLeave(@Body req: LeaveCreateReq): LeaveCreateResp // endpoint ini tidak wrapper

    // SATKER_HEAD: pending
    @GET("leave-requests/pending")
    suspend fun leavePending(): ApiResponse<List<LeavePendingDto>>

    // SATKER_HEAD: all by range
    @GET("leave-requests")
    suspend fun leaveAll(
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<LeaveListDto>>

    // MEMBER: mine by range
    @GET("leave-requests/mine")
    suspend fun leaveMine(
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<LeaveListDto>>

    // APPROVE / REJECT
    @POST("leave-requests/{id}/approve")
    suspend fun approveLeave(
        @Path("id") id: String,
        @Body req: LeaveDecisionReq
    ): ApiResponse<String>

    @POST("leave-requests/{id}/reject")
    suspend fun rejectLeave(
        @Path("id") id: String,
        @Body req: LeaveDecisionReq
    ): ApiResponse<String>

    @Multipart
    @POST("users/me/photo")
    suspend fun uploadProfilePhoto(
        @Part file: MultipartBody.Part
    ): UploadProfilePhotoResponse

    @POST("users/me/password") // ✅ ADD
    suspend fun changeMyPassword(
        @Body body: ChangeMyPasswordReq
    ): ApiResponse<String>

    @GET("users/me")
    suspend fun getMe(): UserMeResponse


    @PUT("users/me/profile")
    suspend fun updateMyProfile(@Body body: UpdateMyProfileReq): ApiResponse<String>

    @GET("settings/timezone")
    suspend fun getTimezone(): ApiResponse<TimezoneData>

    @GET("tukin/calculations")
    suspend fun tukinCalculations(
        @Query("month") month: String,
        @Query("satker_id") satkerId: String,
        @Query("user_id") userId: String
    ): ApiResponse<List<TukinCalculationDto>>

    @POST("tukin/generate")
    suspend fun generateTukin(
        @Query("month") month: String,
        @Query("satker_id") satkerId: String,
        @Query("user_id") userId: String,
        @Query("force") force: Boolean = true
    ): ApiResponse<JsonElement>

    @GET("duty-schedules")
    suspend fun listDutySchedules(
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("satker_id") satkerId: String,
        @Query("user_id") userId: String
    ): ApiResponse<List<DutyScheduleModels>>

    @GET("duty-schedule-requests")
    suspend fun listDutyScheduleRequests(
        @Query("status") status: String,
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<DutyScheduleRequestDto>>

    @POST("duty-schedule-requests")
    suspend fun createDutyScheduleRequest(
        @Body body: CreateDutyScheduleReq
    ): ApiResponse<String>

    @PUT("duty-schedule-requests/{id}/cancel")
    suspend fun cancelDutyScheduleRequest(
        @Path("id") id: String
    ): ApiResponse<String>

    @PUT("duty-schedule-requests/{id}/approve")
    suspend fun approveDutyScheduleRequest(
        @Path("id") id: String
    ): ApiResponse<String>

    @PUT("duty-schedule-requests/{id}/reject")
    suspend fun rejectDutyScheduleRequest(
        @Path("id") id: String,
        @Body body: RejectDutyScheduleRequestReq
    ): ApiResponse<String>
}