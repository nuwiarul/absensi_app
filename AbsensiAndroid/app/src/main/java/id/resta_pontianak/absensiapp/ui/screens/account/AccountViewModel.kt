package id.resta_pontianak.absensiapp.ui.screens.account

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.DutyScheduleDto
import id.resta_pontianak.absensiapp.data.network.LeaveListDto
import id.resta_pontianak.absensiapp.data.network.ProfileUrlProvider
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProvider
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.data.repo.DutyScheduleRepository
import id.resta_pontianak.absensiapp.data.repo.LeaveRepository
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.toLocalDateTime
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream
//import java.time.LocalDate
import kotlinx.datetime.Clock
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import javax.inject.Inject
import id.resta_pontianak.absensiapp.data.local.TukinStore
import id.resta_pontianak.absensiapp.data.repo.TukinRepository
import kotlinx.datetime.toJavaInstant
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.util.Locale

@HiltViewModel
class AccountViewModel @Inject constructor(
    // nanti kalau sudah sambung backend, inject repo di sini
    // private val accountRepo: AccountRepository,
    private val tokenStore: TokenStore,
    private val profileUrlProvider: ProfileUrlProvider,
    val imageLoader: ImageLoader,
    private val api: ApiService,
    private val dutyRepo: DutyScheduleRepository,
    private val settingsRepository: SettingsRepository,
    private val attendanceRepo: AttendanceRepository,
    private val leaveRepo: LeaveRepository,

    // ✅ ADD
    private val tukinRepo: TukinRepository,
    private val tukinStore: TukinStore,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    data class State(
        val fullName: String = "-",
        val nrp: String = "-",
        val profilePhotoKey: String? = null,

        val hadirHari: Int = 0,
        val tidakHadirHari: Int = 0,
        val tunkinNominal: String = "0",
        val tunkinUpdatedAtText: String? = null,
        val isTunkinStale: Boolean = false,
        val isTunkinLoading: Boolean = false,

        val pendingDutySubmittedCount: Int = 0,

        val isUploading: Boolean = false,
        val errorMessage: String? = null,
        val isChangingPassword: Boolean = false, // ✅ ADD
        val successMessage: String? = null,
        val changePasswordError: String? = null,
    )

    sealed interface Action {
        data object InformasiProfil : Action
        data object RiwayatPerizinan : Action
        data object RiwayatKehadiran : Action
        data object RiwayatTunkin : Action
        data object JadwalDinas : Action
        data object Logout : Action
    }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    /*init {
        viewModelScope.launch {
            val p = tokenStore.getProfile()
            if (p != null) {
                _state.value = _state.value.copy(
                    fullName = p.fullName,
                    nrp = p.nrp,
                    profilePhotoKey = p.profilePhotoKey
                )
            }
        }
    }*/

    init {
        viewModelScope.launch { loadLocalProfile() }
    }

    private suspend fun loadLocalProfile() {
        val p = tokenStore.getProfile() ?: return
        _state.value = _state.value.copy(
            fullName = p.fullName,
            nrp = p.nrp,
            profilePhotoKey = p.profilePhotoKey
        )
    }

    fun refreshBadges() {
        viewModelScope.launch { refreshPendingDutySubmittedCount() }
        viewModelScope.launch { refreshMonthlyAttendanceStats() }
        viewModelScope.launch { refreshTukinCard(autoIfStale = true) }
    }

    private suspend fun refreshPendingDutySubmittedCount() {
        try {
            //val from = LocalDate.now().minusYears(1).toString()
            //val to = LocalDate.now().plusYears(1).toString()
            val tz = settingsRepository.getTimezoneCached()
            val (from, to) = DateRangeUtil.currentToNextMonthRange(tz)
            val list = dutyRepo.listDutyScheduleRequests(
                status = "SUBMITTED",
                from = from,
                to = to
            )
            Log.d("DUTY", list.size.toString())
            _state.value = _state.value.copy(pendingDutySubmittedCount = list.size)
        } catch (_: Throwable) {
            // Kalau user tidak punya akses endpoint (mis. MEMBER), anggap 0.
            _state.value = _state.value.copy(pendingDutySubmittedCount = 0)
        }
    }

    private fun parseInstant(s: String?): Instant? =
        try { if (s == null) null else Instant.parse(s) } catch (_: Exception) { null }

    private fun isoAtStartOfDayUtc(date: LocalDate, tzName: String): String {
        val zone = ZoneId.of(tzName)
        val zdt = ZonedDateTime.of(
            date.year, date.monthNumber, date.dayOfMonth,
            0, 0, 0, 0, zone
        )
        return zdt.toInstant().toString()
    }

    private fun isInvalidWithoutLeave(type: String?): Boolean {
        val t = type?.trim()?.uppercase()
        return t == "DINAS_LUAR" || t == "CUTI" || t == "IJIN" || t == "SAKIT"
    }

    private fun isWfaWfh(type: String?): Boolean {
        val t = type?.trim()?.uppercase()
        return t == "WFA" || t == "WFH"
    }

    private suspend fun refreshMonthlyAttendanceStats() {
        try {
            val profile = tokenStore.getProfile() ?: run {
                _state.value = _state.value.copy(hadirHari = 0, tidakHadirHari = 0)
                return
            }

            val tzName = settingsRepository.getTimezoneCached()
            val appTz = TimeZone.of(tzName)

            // range: awal bulan sampai hari ini
            val today = Clock.System.now().toLocalDateTime(appTz).date
            val fromDate = LocalDate(today.year, today.monthNumber, 1)
            val from = fromDate.toString()
            val to = today.toString()

            // 1) attendance sessions
            val sessions = attendanceRepo.listAttendance(from, to)
            val sessionByDate = sessions.associateBy { LocalDate.parse(it.workDate) }

            // 2) working days
            val wdRes = api.workingDays(profile.satkerId, from, to)
            val workingDays = if (wdRes.status == "200") wdRes.data ?: emptyList() else emptyList()
            val wdByDate = workingDays.associateBy { LocalDate.parse(it.workDate) }

            // 3) leave approved -> expand per tanggal
            val approvedLeaves = leaveRepo.mine(from, to, status = "APPROVED")
            val leaveByDate = mutableMapOf<LocalDate, LeaveListDto>()
            for (lr in approvedLeaves) {
                var cur = LocalDate.parse(lr.startDate)
                val end = LocalDate.parse(lr.endDate)
                while (cur <= end) {
                    if (cur >= fromDate && cur <= today) leaveByDate[cur] = lr
                    cur = cur.plus(DatePeriod(days = 1))
                }
            }

            // 4) duty schedules -> map per tanggal (pakai timezone app)
            val dutyFromIso = isoAtStartOfDayUtc(fromDate, tzName)
            val dutyToIso = isoAtStartOfDayUtc(today.plus(DatePeriod(days = 1)), tzName) // exclusive
            val dutyRes = api.dutySchedules(dutyFromIso, dutyToIso, profile.userId)
            val duties = if (dutyRes.status == "200") dutyRes.data ?: emptyList() else emptyList()

            val dutyByDate = mutableMapOf<LocalDate, MutableList<DutyScheduleDto>>()
            for (ds in duties) {
                val startI = parseInstant(ds.startAt) ?: continue
                val endI = parseInstant(ds.endAt) ?: startI

                val startDate = startI.toLocalDateTime(appTz).date
                val endDate = endI.toLocalDateTime(appTz).date

                var d = startDate
                while (d <= endDate) {
                    if (d >= fromDate && d <= today) dutyByDate.getOrPut(d) { mutableListOf() }.add(ds)
                    d = d.plus(DatePeriod(days = 1))
                }
            }

            // ===================== COUNT =====================
            var hadir = 0
            var tidakHadir = 0

            var d = fromDate
            while (d <= today) {
                val wd = wdByDate[d]
                val sess = sessionByDate[d]
                val lr = leaveByDate[d]
                val hasDuty = !dutyByDate[d].isNullOrEmpty()

                val isHoliday = wd?.dayType == "HOLIDAY"

                // RULE: holiday tidak dihitung kecuali ada duty schedule
                if (isHoliday && !hasDuty) {
                    d = d.plus(DatePeriod(days = 1))
                    continue
                }

                // RULE: leave-request dulu => hadir
                if (lr != null) {
                    hadir++
                    d = d.plus(DatePeriod(days = 1))
                    continue
                }

                val hasCheckIn = !sess?.checkInAt.isNullOrBlank()

                // RULE: duty schedule
                if (hasDuty) {
                    if (hasCheckIn) hadir++ else tidakHadir++
                    d = d.plus(DatePeriod(days = 1))
                    continue
                }

                // RULE: attendance_leave_type
                val attIn = sess?.checkInLeaveType
                val attOut = sess?.checkOutLeaveType
                val invalid = isInvalidWithoutLeave(attIn) || isInvalidWithoutLeave(attOut)

                if (invalid) {
                    // DINAS_LUAR/CUTI/IJIN/SAKIT tanpa leave-approved => tidak hadir
                    tidakHadir++
                    d = d.plus(DatePeriod(days = 1))
                    continue
                }

                val wfaWfh = isWfaWfh(attIn) || isWfaWfh(attOut)
                if (wfaWfh) {
                    if (hasCheckIn) hadir++ else tidakHadir++
                    d = d.plus(DatePeriod(days = 1))
                    continue
                }

                // RULE: normal workday
                if (hasCheckIn) hadir++ else tidakHadir++

                d = d.plus(DatePeriod(days = 1))
            }

            _state.value = _state.value.copy(
                hadirHari = hadir,
                tidakHadirHari = tidakHadir
            )
        } catch (_: Throwable) {
            // kalau error jaringan dsb, jangan bikin crash. biarkan nilai lama / set 0
            _state.value = _state.value.copy(hadirHari = 0, tidakHadirHari = 0)
        }
    }

    private val STALE_MS = 6 * 60 * 60_000L       // 6 jam dianggap stale
    private val AUTO_COOLDOWN_MS = 6 * 60 * 60_000L // auto-generate max 1x/6 jam
    private val MANUAL_COOLDOWN_MS = 2 * 60_000L    // manual minimal 2 menit

    private fun formatRupiah(value: Long): String {
        val nf = NumberFormat.getNumberInstance(Locale("id", "ID"))
        return nf.format(value)
    }

    private fun formatUpdatedAt(isoUtc: String, tzName: String): String {
        return try {
            val instant = Instant.parse(isoUtc)
            val javaInstant = instant.toJavaInstant()
            val z = javaInstant.atZone(ZoneId.of(tzName))
            val fmt = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", Locale("id","ID"))
            z.format(fmt)
        } catch (_: Throwable) {
            isoUtc
        }
    }

    private fun currentMonthString(tzName: String): String {
        val now = java.time.ZonedDateTime.now(ZoneId.of(tzName))
        val y = now.year
        val m = now.monthValue
        return "%04d-%02d".format(y, m)
    }

    /**
     * load cepat: getCalculation()
     * kalau stale & autoIfStale=true: auto-generate (dibatasi cooldown) lalu fetch ulang
     */
    private suspend fun refreshTukinCard(autoIfStale: Boolean) {
        val p = tokenStore.getProfile() ?: return
        val tz = settingsRepository.getTimezoneCached()

        val month = currentMonthString(tz)

        // 1) GET cepat
        _state.value = _state.value.copy(isTunkinLoading = true)
        val calc = try {
            tukinRepo.getCalculation(month)
        } catch (e: Throwable) {
            _state.value = _state.value.copy(
                isTunkinLoading = false,
                // biarkan nominal tetap, supaya tidak “kedip”
                errorMessage = ApiErrorParser.parse(e)
            )
            return
        }

        val updatedAt = calc?.updated_at
        val nowMs = System.currentTimeMillis()
        val updatedMs = try { if (updatedAt == null) 0L else Instant.parse(updatedAt).toEpochMilliseconds() } catch (_: Throwable) { 0L }
        val isStale = (updatedMs == 0L) || (nowMs - updatedMs > STALE_MS)

        val nominal = calc?.final_tukin?.toLong() ?: 0L
        val updatedText = if (!updatedAt.isNullOrBlank()) "Terakhir dihitung: ${formatUpdatedAt(updatedAt, tz)}" else "Belum pernah dihitung"

        _state.value = _state.value.copy(
            tunkinNominal = formatRupiah(nominal),
            tunkinUpdatedAtText = updatedText,
            isTunkinStale = isStale,
            isTunkinLoading = false
        )

        // 2) AUTO generate bila stale (dibatasi)
        if (!autoIfStale || !isStale) return

        val lastGen = tukinStore.getLastGenerateMs(p.userId, month)
        val canAuto = (nowMs - lastGen) >= AUTO_COOLDOWN_MS
        if (!canAuto) return

        // jalan generate + fetch ulang
        try {
            _state.value = _state.value.copy(isTunkinLoading = true)
            tukinStore.setLastGenerateMs(p.userId, month, nowMs)
            tukinRepo.generate(month, force = true)

            val after = tukinRepo.getCalculation(month)
            val afterUpdatedAt = after?.updated_at
            val afterNominal = after?.final_tukin?.toLong() ?: nominal
            val afterText = if (!afterUpdatedAt.isNullOrBlank()) {
                "Terakhir dihitung: ${formatUpdatedAt(afterUpdatedAt, tz)}"
            } else updatedText

            _state.value = _state.value.copy(
                tunkinNominal = formatRupiah(afterNominal),
                tunkinUpdatedAtText = afterText,
                isTunkinStale = false,
                isTunkinLoading = false
            )
        } catch (e: Throwable) {
            _state.value = _state.value.copy(
                isTunkinLoading = false,
                errorMessage = ApiErrorParser.parse(e)
            )
        }
    }

    fun onRefreshTukinManual() {
        viewModelScope.launch {
            val p = tokenStore.getProfile() ?: return@launch
            val tz = settingsRepository.getTimezoneCached()
            val month = currentMonthString(tz)

            val nowMs = System.currentTimeMillis()
            val lastGen = tukinStore.getLastGenerateMs(p.userId, month)
            if ((nowMs - lastGen) < MANUAL_COOLDOWN_MS) {
                _state.value = _state.value.copy(errorMessage = "Tunkin baru saja diperbarui. Coba lagi sebentar ya.")
                return@launch
            }

            try {
                _state.value = _state.value.copy(isTunkinLoading = true)
                tukinStore.setLastGenerateMs(p.userId, month, nowMs)
                tukinRepo.generate(month, force = true)
                // fetch ulang biar angka benar
                val after = tukinRepo.getCalculation(month)
                val updatedAt = after?.updated_at
                val nominal = after?.final_tukin?.toLong() ?: 0L
                val updatedText = if (!updatedAt.isNullOrBlank()) {
                    "Terakhir dihitung: ${formatUpdatedAt(updatedAt, tz)}"
                } else "Belum pernah dihitung"

                _state.value = _state.value.copy(
                    tunkinNominal = formatRupiah(nominal),
                    tunkinUpdatedAtText = updatedText,
                    isTunkinStale = false,
                    isTunkinLoading = false,
                    successMessage = "Tunkin berhasil diperbarui"
                )
            } catch (e: Throwable) {
                _state.value = _state.value.copy(
                    isTunkinLoading = false,
                    errorMessage = ApiErrorParser.parse(e)
                )
            }
        }
    }



    fun consumeError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun consumeSuccess() { // ✅ ADD
        _state.value = _state.value.copy(successMessage = null)
    }

    fun consumeChangePasswordError() { // ✅ ADD
        _state.value = _state.value.copy(changePasswordError = null)
    }
    fun refreshLocal() { // ✅ ADD
        viewModelScope.launch { loadLocalProfile() }
    }


    fun onAction(action: Action) {
        when (action) {
            Action.InformasiProfil -> {}
            Action.RiwayatPerizinan -> {}
            Action.RiwayatKehadiran -> {}
            Action.RiwayatTunkin -> {}
            Action.JadwalDinas -> {}
            Action.Logout -> {}
        }
    }

    fun profileUrl(key: String): String = profileUrlProvider.build(key)

    fun uploadProfilePhotoFromUri(uri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isUploading = true)

            try {
                val part = buildMultipartFromUri(
                    resolver = appContext.contentResolver,
                    uri = uri
                )

                val res = api.uploadProfilePhoto(part)

                val newKey = res.data
                if (res.status == "200" && !newKey.isNullOrBlank()) {
                    // ✅ simpan key
                    tokenStore.setProfilePhotoKey(newKey)

                    // ✅ langsung ganti avatar
                    _state.value = _state.value.copy(
                        profilePhotoKey = newKey,
                        isUploading = false
                    )
                } else {
                    // kalau status/data tidak sesuai
                    _state.value = _state.value.copy(
                        isUploading = false,
                        errorMessage = "gagal"
                    )
                }
            } catch (e: Throwable) {
                val msg = ApiErrorParser.parse(e) // ✅ akan jadi "gagal" kalau server balikin {"message":"gagal"}
                _state.value = _state.value.copy(
                    isUploading = false,
                    errorMessage = msg
                )
            }
        }
    }

    private fun buildMultipartFromUri(
        resolver: ContentResolver,
        uri: Uri
    ): MultipartBody.Part {
        // Copy content Uri -> temp file (stabil untuk retrofit)
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val ext = when {
            mime.contains("png") -> ".png"
            mime.contains("jpg") || mime.contains("jpeg") -> ".jpg"
            else -> ""
        }

        val tmp = File.createTempFile("profile_", ext, appContext.cacheDir)
        resolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Tidak bisa membaca file" }
            FileOutputStream(tmp).use { out -> input.copyTo(out) }
        }

        val rb = tmp.asRequestBody(mime.toMediaTypeOrNull())
        return MultipartBody.Part.createFormData(
            name = "file",
            filename = tmp.name,
            body = rb
        )
    }

    fun changeMyPassword(
        oldPassword: String,
        password: String,
        passwordConfirm: String,
        onSuccessCloseDialog: () -> Unit // dipanggil dari Route supaya dialog ditutup
    ) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isChangingPassword = true)

            try {
                val res = api.changeMyPassword(
                    id.resta_pontianak.absensiapp.data.network.ChangeMyPasswordReq(
                        old_password = oldPassword,
                        password = password,
                        password_confirm = passwordConfirm
                    )
                )

                if (res.status == "200") {
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        successMessage = "Sukses ganti password",
                        changePasswordError = null
                    )
                    onSuccessCloseDialog()
                } else {
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        changePasswordError = res.message ?: "gagal"
                    )
                }
            } catch (e: Throwable) {
                val msg = ApiErrorParser.parse(e)
                _state.value = _state.value.copy(
                    isChangingPassword = false,
                    changePasswordError = msg
                )
            }
        }
    }

}
