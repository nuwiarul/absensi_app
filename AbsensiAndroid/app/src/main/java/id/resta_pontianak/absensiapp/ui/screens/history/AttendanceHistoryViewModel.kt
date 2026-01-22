package id.resta_pontianak.absensiapp.ui.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.*
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.data.repo.LeaveRepository
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import id.resta_pontianak.absensiapp.ui.helper.DateRangeUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.*
import java.time.ZoneId
import java.time.ZonedDateTime
import javax.inject.Inject

@HiltViewModel
class AttendanceHistoryViewModel @Inject constructor(
    private val repo: AttendanceRepository,
    private val leaveRepo: LeaveRepository,
    private val settingsRepo: SettingsRepository,
    private val api: ApiService,
    private val selfieUrlProvider: SelfieUrlProvider,
    val imageLoader: ImageLoader
) : ViewModel() {

    data class State(
        val from: LocalDate,
        val to: LocalDate,
        val isLoading: Boolean = false,
        val error: String? = null,
        val items: List<AttendanceDayUi> = emptyList(),
        val selected: AttendanceDayUi? = null,
        val photoKey: String? = null
    )

    private val tzDevice = TimeZone.currentSystemDefault()
    private val initialRange = DateRangeUtils.currentMonthRangeJakarta()

    private val _state = MutableStateFlow(State(from = initialRange.first, to = initialRange.second))
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        applyFilter()
    }

    fun setFrom(date: LocalDate) = _state.update { it.copy(from = date) }
    fun setTo(date: LocalDate) = _state.update { it.copy(to = date) }

    fun resetToCurrentMonth() {
        val (f, t) = DateRangeUtils.currentMonthRangeJakarta()
        _state.update { it.copy(from = f, to = t) }
        applyFilter()
    }

    fun applyFilter() {
        val s = _state.value
        if (s.from > s.to) {
            _state.update { it.copy(error = "Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                // identity
                val me = api.getMe().data ?: error("User tidak ditemukan")
                val satkerId = me.satker.id
                val userId = me.id

                // app timezone
                //val tzName = api.getTimezone().data?.timezone ?: "Asia/Jakarta"
                val tzName = settingsRepo.getTimezoneCached()
                val appTz = TimeZone.of(tzName)

                // clamp range sampai hari ini (sesuai requirement)
                val today = Clock.System.now().toLocalDateTime(appTz).date
                val effectiveTo = if (s.to > today) today else s.to

                // fetch
                val sessions = repo.listAttendance(s.from.toString(), effectiveTo.toString())

                android.util.Log.d("HISTORY", "me.id=$userId satkerId=$satkerId sessions.size=${sessions.size}")

// JIKA AttendanceSessionDto punya userId
                android.util.Log.d(
                    "HISTORY",
                    "uniqueUsersInSessions=" + sessions.map { it.userId }.distinct().size
                )
                android.util.Log.d(
                    "HISTORY",
                    "users=" + sessions.map { it.userId }.distinct().joinToString()
                )

                val leaveApproved = leaveRepo.mine(s.from.toString(), effectiveTo.toString())
                    .filter { it.status.equals("APPROVED", ignoreCase = true) }

                val workingDays = api.workingDays(satkerId, s.from.toString(), effectiveTo.toString()).data ?: emptyList()

                // duty schedule expects DateTime<Utc> -> send UTC Instant (Z)
                val dutyFrom = isoAtStartOfDayUtc(s.from, tzName)
                val dutyTo = isoAtStartOfDayUtc(effectiveTo.plus(DatePeriod(days = 1)), tzName) // exclusive
                val duties = api.dutySchedules(dutyFrom, dutyTo, userId).data ?: emptyList()

                val mapped = mergeRecap(
                    from = s.from,
                    to = effectiveTo,
                    sessions = sessions,
                    workingDays = workingDays,
                    approvedLeaves = leaveApproved,
                    dutySchedules = duties,
                    deviceTz = appTz,
                    appTzName = tzName
                ).sortedByDescending { it.workDate }

                _state.update { it.copy(isLoading = false, items = mapped) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Gagal memuat riwayat") }
            }
        }
    }

    fun openDetail(item: AttendanceDayUi) = _state.update { it.copy(selected = item) }
    fun closeDetail() = _state.update { it.copy(selected = null) }

    fun previewPhoto(key: String) = _state.update { it.copy(photoKey = key) }
    fun closePhoto() = _state.update { it.copy(photoKey = null) }

    fun consumeError() = _state.update { it.copy(error = null) }

    fun selfieUrl(key: String): String = selfieUrlProvider.build(key)
}

/* ======================= UI MODEL ======================= */

data class AttendanceDayUi(
    val workDate: LocalDate,

    // user
    val fullName: String,
    val nrp: String,
    val satkerName: String,
    val satkerCode: String?,

    // kalender kerja
    val dayType: String?,              // WORKDAY | HALF_DAY | HOLIDAY
    val expectedStart: String?,        // HH:mm:ss
    val expectedEnd: String?,          // HH:mm:ss

    // leave request APPROVED
    val leaveType: String?,            // Sakit / Cuti / Ijin / dll
    val leaveReason: String?,

    // duty schedule
    val hasDutySchedule: Boolean,
    val dutyCount: Int,
    val dutyTitle: String?,
    val dutyNote: String?,

    // session attendance
    val sessionId: String?,
    val checkInAtLocal: LocalDateTime?,
    val checkOutAtLocal: LocalDateTime?,

    // attendance_leave_type
    val attendanceLeaveTypeIn: String?,
    val attendanceLeaveTypeOut: String?,

    // status display
    val statusIn: String?,
    val statusOut: String?,
    val statusDetailIn: String?,
    val statusDetailOut: String?,

    // late / early
    val lateMinutes: Int?,
    val earlyOutMinutes: Int?,

    // detail tambahan (dialog)
    val checkInDistanceM: Double?,
    val checkOutDistanceM: Double?,
    val checkInGeofenceName: String?,
    val checkOutGeofenceName: String?,
    val checkInLeaveNotes: String?,
    val checkOutLeaveNotes: String?,
    val checkInDeviceId: String?,
    val checkOutDeviceId: String?,
    val checkInDeviceName: String?,
    val checkOutDeviceName: String?,
    val checkInDeviceModel: String?,
    val checkOutDeviceModel: String?,
    val checkInSelfieKey: String?,
    val checkOutSelfieKey: String?,
)

/* ======================= MERGE LOGIC ======================= */

private fun parseInstant(s: String?): Instant? =
    try { if (s == null) null else Instant.parse(s) } catch (_: Exception) { null }

private fun AttendanceSessionDto.toPart(tz: TimeZone): SessionPart {
    return SessionPart(
        sessionId = sessionId,
        workDate = LocalDate.parse(workDate),
        fullName = fullName,
        nrp = nrp,
        satkerName = satkerName,
        satkerCode = satkerCode,

        checkInAtLocal = parseInstant(checkInAt)?.toLocalDateTime(tz),
        checkOutAtLocal = parseInstant(checkOutAt)?.toLocalDateTime(tz),

        inLeaveType = checkInLeaveType,
        outLeaveType = checkOutLeaveType,
        inGeofenceName = checkInGeofenceName,
        outGeofenceName = checkOutGeofenceName,

        checkInDistanceM = checkInDistanceM,
        checkOutDistanceM = checkOutDistanceM,

        checkInLeaveNotes = checkInLeaveNotes,
        checkOutLeaveNotes = checkOutLeaveNotes,

        checkInDeviceId = checkInDeviceId,
        checkOutDeviceId = checkOutDeviceId,
        checkInDeviceName = checkInDeviceName,
        checkOutDeviceName = checkOutDeviceName,
        checkInDeviceModel = checkInDeviceModel,
        checkOutDeviceModel = checkOutDeviceModel,

        checkInSelfieKey = checkInSelfieKey,
        checkOutSelfieKey = checkOutSelfieKey,
    )
}

private data class SessionPart(
    val sessionId: String,
    val workDate: LocalDate,
    val fullName: String,
    val nrp: String,
    val satkerName: String,
    val satkerCode: String?,

    val checkInAtLocal: LocalDateTime?,
    val checkOutAtLocal: LocalDateTime?,

    val inLeaveType: String?,
    val outLeaveType: String?,
    val inGeofenceName: String?,
    val outGeofenceName: String?,

    val checkInDistanceM: Double?,
    val checkOutDistanceM: Double?,

    val checkInLeaveNotes: String?,
    val checkOutLeaveNotes: String?,

    val checkInDeviceId: String?,
    val checkOutDeviceId: String?,
    val checkInDeviceName: String?,
    val checkOutDeviceName: String?,
    val checkInDeviceModel: String?,
    val checkOutDeviceModel: String?,

    val checkInSelfieKey: String?,
    val checkOutSelfieKey: String?,
)

private fun statusFromAttendanceLeaveType(attLeaveType: String?, geofenceName: String?): Pair<String, String?> {
    val t = attLeaveType?.trim().orEmpty()
    if (t.isBlank() || t.equals("NORMAL", ignoreCase = true)) return "Normal" to geofenceName
    return t to geofenceName
}

private fun parseLocalTimeHHmmssOrNull(s: String?): LocalTime? {
    if (s.isNullOrBlank()) return null
    return try {
        val parts = s.split(":")
        val h = parts.getOrNull(0)?.toIntOrNull() ?: return null
        val m = parts.getOrNull(1)?.toIntOrNull() ?: return null
        LocalTime(h, m)
    } catch (_: Exception) { null }
}

private fun minutesDiff(a: LocalTime, b: LocalTime): Int {
    val aMin = a.hour * 60 + a.minute
    val bMin = b.hour * 60 + b.minute
    return bMin - aMin
}

private fun isAttTypeInvalidWithoutLeave(t: String?): Boolean {
    val x = t?.trim()?.uppercase() ?: return false
    return x == "DINAS_LUAR" || x == "CUTI" || x == "IJIN"
}

private fun isWfaWfh(t: String?): Boolean {
    val x = t?.trim()?.uppercase() ?: return false
    return x == "WFA" || x == "WFH"
}

private fun mergeRecap(
    from: LocalDate,
    to: LocalDate,
    sessions: List<AttendanceSessionDto>,
    workingDays: List<WorkingDayDto>,
    approvedLeaves: List<LeaveListDto>,
    dutySchedules: List<DutyScheduleDto>,
    deviceTz: TimeZone,
    appTzName: String,
): List<AttendanceDayUi> {

    val appTz = TimeZone.of(appTzName)

    // 1) session by date (pakai work_date dari backend)
    val sessionByDate = sessions.map { it.toPart(deviceTz) }.associateBy { it.workDate }

    // 2) working days by date
    val wdByDate = workingDays.associateBy { LocalDate.parse(it.workDate) }

    // 3) leave approved per tanggal (expand range)
    val leaveByDate = mutableMapOf<LocalDate, LeaveListDto>()
    for (lr in approvedLeaves) {
        var cur = LocalDate.parse(lr.startDate)
        val end = LocalDate.parse(lr.endDate)
        while (cur <= end) {
            if (cur >= from && cur <= to) {
                leaveByDate[cur] = lr
            }
            cur = cur.plus(DatePeriod(days = 1))
        }
    }

    // 4) duty schedule per tanggal (expand start_at..end_at)
    val dutyByDate = mutableMapOf<LocalDate, MutableList<DutyScheduleDto>>()
    for (ds in dutySchedules) {
        val startI = parseInstant(ds.startAt) ?: continue
        val endI = parseInstant(ds.endAt) ?: startI

        var cur = startI.toLocalDateTime(appTz).date
        val endDate = endI.toLocalDateTime(appTz).date

        var d = cur
        while (d <= endDate) {
            if (d >= from && d <= to) dutyByDate.getOrPut(d) { mutableListOf() }.add(ds)
            d = d.plus(DatePeriod(days = 1))
        }
    }

    val out = ArrayList<AttendanceDayUi>()

    var d = from
    while (d <= to) {
        val wd = wdByDate[d]
        val sess = sessionByDate[d]
        val lr = leaveByDate[d]
        val dutyList = dutyByDate[d]


        val isHoliday = wd?.dayType == "HOLIDAY"
        val hasDuty = !dutyList.isNullOrEmpty()

        // FLOW (1): holiday jangan tampil kecuali ada duty schedule
        if (isHoliday && !hasDuty) {
            d = d.plus(DatePeriod(days = 1))
            continue
        }

        // identity fallback
        val anySess = sess ?: sessionByDate.values.firstOrNull()
        val fullName = anySess?.fullName ?: "-"
        val nrp = anySess?.nrp ?: "-"
        val satkerName = anySess?.satkerName ?: "-"
        val satkerCode = anySess?.satkerCode

        // times (default dari session)
        var checkInLocal = sess?.checkInAtLocal
        var checkOutLocal = sess?.checkOutAtLocal

        // detail fields (default dari session)
        val checkInDistanceM = sess?.checkInDistanceM
        val checkOutDistanceM = sess?.checkOutDistanceM
        val checkInGeofenceName = sess?.inGeofenceName
        val checkOutGeofenceName = sess?.outGeofenceName
        val checkInLeaveNotes = sess?.checkInLeaveNotes
        val checkOutLeaveNotes = sess?.checkOutLeaveNotes
        val checkInDeviceId = sess?.checkInDeviceId
        val checkOutDeviceId = sess?.checkOutDeviceId
        val checkInDeviceName = sess?.checkInDeviceName
        val checkOutDeviceName = sess?.checkOutDeviceName
        val checkInDeviceModel = sess?.checkInDeviceModel
        val checkOutDeviceModel = sess?.checkOutDeviceModel
        val checkInSelfieKey = sess?.checkInSelfieKey
        val checkOutSelfieKey = sess?.checkOutSelfieKey

        // attendance_leave_type (as is)
        val attIn = sess?.inLeaveType
        val attOut = sess?.outLeaveType

        // ====== STATUS calculation sesuai flow bisnis kamu ======

        var statusIn: String? = null
        var statusOut: String? = null
        var statusDetailIn: String? = null
        var statusDetailOut: String? = null

        // FLOW (2): cek leave-request dulu, kalau ada -> status leave_type, jam "-" (null)
        if (lr != null) {
            statusIn = lr.tipe
            statusOut = lr.tipe
            statusDetailIn = lr.reason
            statusDetailOut = lr.reason

            checkInLocal = null
            checkOutLocal = null
        } else if (hasDuty) {
            // FLOW (3): duty schedule
            // - jika ada check_in_at -> status DUTY
            // - jika tidak ada check_in_at -> status TANPA ABSEN
            val dutyDetail = dutyList!!.firstOrNull()?.title?.takeIf { it.isNotBlank() }
                ?: dutyList.firstOrNull()?.note

            val hasCheckIn = checkInLocal != null
            if (hasCheckIn) {
                statusIn = "Duty"
                statusOut = "Duty"
            } else {
                statusIn = "Tanpa Absen"
                statusOut = "Tanpa Absen"
            }
            statusDetailIn = dutyDetail
            statusDetailOut = dutyDetail
            // jam tetap tampil (kalau ada)
        } else if (sess != null) {
            // FLOW (4): attendance_leave_type
            // DINAS_LUAR/CUTI/IJIN -> harus ada leave request, kalau tidak ada => status TANPA ABSEN
            // WFA/WFH -> perlakukan seperti normal, status WFA/WFH, hitung late
            val inInvalid = isAttTypeInvalidWithoutLeave(attIn)
            val outInvalid = isAttTypeInvalidWithoutLeave(attOut)

            // Jika salah satu invalid tanpa leave -> anggap TANPA ABSEN (tapi jam tetap tampil kalau ada)
            if (inInvalid || outInvalid) {
                statusIn = "Tanpa Absen"
                statusOut = "Tanpa Absen"
                statusDetailIn = null
                statusDetailOut = null
            } else if (isWfaWfh(attIn) || isWfaWfh(attOut)) {
                // status tampil WFA/WFH (ambil dari IN kalau ada, else OUT)
                val label = (attIn?.trim()?.takeIf { it.isNotBlank() } ?: attOut?.trim())
                statusIn = label ?: "Normal"
                statusOut = label ?: "Normal"
                // detail boleh geofence (kalau kamu mau)
                statusDetailIn = checkInGeofenceName
                statusDetailOut = checkOutGeofenceName
            } else {
                // normal / lainnya
                // kalau kosong/NORMAL -> Normal
                val inKind = attIn?.trim().orEmpty()
                val outKind = attOut?.trim().orEmpty()

                statusIn = if (inKind.isBlank() || inKind.equals("NORMAL", true)) "Normal" else inKind
                statusOut = if (outKind.isBlank() || outKind.equals("NORMAL", true)) "Normal" else outKind
                statusDetailIn = checkInGeofenceName
                statusDetailOut = checkOutGeofenceName
            }
        } else {
            // FLOW default: tidak ada apa-apa => Tanpa Absen
            statusIn = "Tanpa Absen"
            statusOut = "Tanpa Absen"
            statusDetailIn = null
            statusDetailOut = null
        }

        // ====== Late / Early ======
        // FLOW (5): late hanya untuk status "Normal" dan WFA/WFH (check-in saja)
        val expStartT = parseLocalTimeHHmmssOrNull(wd?.expectedStart)
        val expEndT = parseLocalTimeHHmmssOrNull(wd?.expectedEnd)
        val inT = checkInLocal?.time
        val outT = checkOutLocal?.time

        val statusForLate = statusIn?.trim()?.uppercase() ?: ""
        val lateAllowed = (statusForLate == "NORMAL" || statusForLate == "WFA" || statusForLate == "WFH")

        val lateMinutes = if (inT != null && expStartT != null && !isHoliday && lateAllowed) {
            val diff = minutesDiff(expStartT, inT)
            if (diff < 0) 0 else diff
        } else null

        // earlyOut optional (biar UI kamu tetap bisa tampil)
        val earlyOutMinutes = if (outT != null && expEndT != null && !isHoliday && statusForLate == "NORMAL") {
            val diff = minutesDiff(outT, expEndT)
            if (diff < 0) 0 else diff
        } else null

        out.add(
            AttendanceDayUi(
                workDate = d,

                fullName = fullName,
                nrp = nrp,
                satkerName = satkerName,
                satkerCode = satkerCode,

                dayType = wd?.dayType,
                expectedStart = wd?.expectedStart,
                expectedEnd = wd?.expectedEnd,

                leaveType = lr?.tipe,
                leaveReason = lr?.reason,

                hasDutySchedule = hasDuty,
                dutyCount = dutyList?.size ?: 0,

                dutyTitle = dutyList?.firstOrNull()?.title,
                dutyNote = dutyList?.firstOrNull()?.note,

                sessionId = sess?.sessionId,
                checkInAtLocal = checkInLocal,
                checkOutAtLocal = checkOutLocal,

                attendanceLeaveTypeIn = attIn,
                attendanceLeaveTypeOut = attOut,

                statusIn = statusIn,
                statusOut = statusOut,
                statusDetailIn = statusDetailIn,
                statusDetailOut = statusDetailOut,

                lateMinutes = lateMinutes,
                earlyOutMinutes = earlyOutMinutes,

                checkInDistanceM = checkInDistanceM,
                checkOutDistanceM = checkOutDistanceM,
                checkInGeofenceName = checkInGeofenceName,
                checkOutGeofenceName = checkOutGeofenceName,
                checkInLeaveNotes = checkInLeaveNotes,
                checkOutLeaveNotes = checkOutLeaveNotes,
                checkInDeviceId = checkInDeviceId,
                checkOutDeviceId = checkOutDeviceId,
                checkInDeviceName = checkInDeviceName,
                checkOutDeviceName = checkOutDeviceName,
                checkInDeviceModel = checkInDeviceModel,
                checkOutDeviceModel = checkOutDeviceModel,
                checkInSelfieKey = checkInSelfieKey,
                checkOutSelfieKey = checkOutSelfieKey,
            )
        )

        d = d.plus(DatePeriod(days = 1))
    }

    return out
}

/* ======================= TIME HELPERS ======================= */

private fun isoAtStartOfDayUtc(date: LocalDate, tzName: String): String {
    val zone = ZoneId.of(tzName)
    val zdt = ZonedDateTime.of(
        date.year, date.monthNumber, date.dayOfMonth,
        0, 0, 0, 0, zone
    )
    return zdt.toInstant().toString() // RFC3339 UTC (…Z)
}


/*
package id.resta_pontianak.absensiapp.ui.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProvider
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.ui.helper.DateRangeUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.*
import javax.inject.Inject
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionDto

@HiltViewModel
class AttendanceHistoryViewModel @Inject constructor(
    private val repo: AttendanceRepository,
    private val selfieUrlProvider: SelfieUrlProvider,
    val imageLoader: ImageLoader
) : ViewModel() {

    data class State(
        val from: LocalDate,
        val to: LocalDate,
        val isLoading: Boolean = false,
        val error: String? = null,
        val items: List<AttendanceSessionUi> = emptyList(),
        val selected: AttendanceSessionUi? = null,
        val photoKey: String? = null
    )

    private val tzDevice = TimeZone.currentSystemDefault()
    private val initialRange = DateRangeUtils.currentMonthRangeJakarta()

    private val _state = MutableStateFlow(State(from = initialRange.first, to = initialRange.second))
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        applyFilter() // auto load bulan berjalan
    }

    fun setFrom(date: LocalDate) = _state.update { it.copy(from = date) }
    fun setTo(date: LocalDate) = _state.update { it.copy(to = date) }

    fun resetToCurrentMonth() {
        val (f, t) = DateRangeUtils.currentMonthRangeJakarta()
        _state.update { it.copy(from = f, to = t) }
        applyFilter()
    }

    fun applyFilter() {
        val s = _state.value
        if (s.from > s.to) {
            _state.update { it.copy(error = "Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val list = repo.listAttendance(s.from.toString(), s.to.toString())
                val mapped = list.map { it.toUi(tzDevice) }
                    .sortedByDescending { it.workDate }

                _state.update { it.copy(isLoading = false, items = mapped) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Gagal memuat riwayat") }
            }
        }
    }

    fun openDetail(item: AttendanceSessionUi) = _state.update { it.copy(selected = item) }
    fun closeDetail() = _state.update { it.copy(selected = null) }

    fun previewPhoto(key: String) = _state.update { it.copy(photoKey = key) }
    fun closePhoto() = _state.update { it.copy(photoKey = null) }

    fun consumeError() = _state.update { it.copy(error = null) }

    fun selfieUrl(key: String): String = selfieUrlProvider.build(key)
}

*/
/** ---------- UI Model ---------- *//*

data class AttendanceSessionUi(
    val sessionId: String,
    val workDate: LocalDate,

    val fullName: String,
    val nrp: String,
    val satkerName: String,
    val satkerCode: String?,

    val checkInAtLocal: LocalDateTime?,
    val checkOutAtLocal: LocalDateTime?,

    val checkInSubtitle: String?,
    val checkOutSubtitle: String?,

    val checkInDistanceM: Double?,
    val checkOutDistanceM: Double?,

    val checkInLeaveNotes: String?,
    val checkOutLeaveNotes: String?,

    val checkInDeviceId: String?,
    val checkOutDeviceId: String?,
    val checkInDeviceName: String?,
    val checkOutDeviceName: String?,
    val checkInDeviceModel: String?,
    val checkOutDeviceModel: String?,

    val checkInSelfieKey: String?,
    val checkOutSelfieKey: String?
)

*/
/** ---------- Mapper ---------- *//*

private fun parseIsoInstantOrNull(s: String?): Instant? =
    try { if (s == null) null else Instant.parse(s) } catch (_: Exception) { null }

private fun subtitle(leaveType: String?, geofenceName: String?): String? {
    val t = leaveType?.trim().orEmpty()
    return if (t.equals("NORMAL", ignoreCase = true)) geofenceName
    else if (t.isNotEmpty()) t else geofenceName
}

fun AttendanceSessionDto.toUi(timeZone: TimeZone): AttendanceSessionUi {
    val inInstant = parseIsoInstantOrNull(checkInAt)
    val outInstant = parseIsoInstantOrNull(checkOutAt)

    return AttendanceSessionUi(
        sessionId = sessionId,
        workDate = LocalDate.parse(workDate),

        fullName = fullName,
        nrp = nrp,
        satkerName = satkerName,
        satkerCode = satkerCode,

        checkInAtLocal = inInstant?.toLocalDateTime(timeZone),
        checkOutAtLocal = outInstant?.toLocalDateTime(timeZone),

        checkInSubtitle = subtitle(checkInLeaveType, checkInGeofenceName),
        checkOutSubtitle = subtitle(checkOutLeaveType, checkOutGeofenceName),

        checkInDistanceM = checkInDistanceM,
        checkOutDistanceM = checkOutDistanceM,

        checkInLeaveNotes = checkInLeaveNotes,
        checkOutLeaveNotes = checkOutLeaveNotes,

        checkInDeviceId = checkInDeviceId,
        checkOutDeviceId = checkOutDeviceId,
        checkInDeviceName = checkInDeviceName,
        checkOutDeviceName = checkOutDeviceName,
        checkInDeviceModel = checkInDeviceModel,
        checkOutDeviceModel = checkOutDeviceModel,

        checkInSelfieKey = checkInSelfieKey,
        checkOutSelfieKey = checkOutSelfieKey
    )
}
*/
