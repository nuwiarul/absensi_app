package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.annotation.SuppressLint
import android.app.Application
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.GeofenceModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

data class AttendanceMapUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val geofence: GeofenceModel? = null,
    val userLat: Double? = null,
    val userLon: Double? = null,
    val accuracyM: Double? = null,
    val distanceM: Double? = null,
    val insideArea: Boolean? = null,
    val geofences: List<GeofenceModel> = emptyList(),

    val isMock: Boolean? = null,
    val provider: String? = null,
    val locationAgeMs: Long? = null,
)

@HiltViewModel
class AttendanceMapViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val app: Application
) : ViewModel() {

    private val _state = MutableStateFlow(AttendanceMapUiState())
    val state: StateFlow<AttendanceMapUiState> = _state

    // stabilizer geofence
    private var lastSwitchAtMs: Long = 0L
    private val switchCooldownMs: Long = 10_000L
    private val minImproveMeters: Double = 15.0
    private val maxAccuracyToSwitch: Double = 50.0

    // ✅ supaya lastLocation & getCurrentLocation gak “balapan”
    private var locationRequestId: Long = 0L

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            try {
                val profile = tokenStore.getProfile()
                    ?: error("Profile tidak ditemukan, silakan login ulang")

                val res = api.geofences()
                val list = res.data ?: emptyList()

                val activeForSatker = list.filter {
                    it.is_active &&
                            it.satker.is_active &&
                            it.satker.id == profile.satkerId
                }

                if (activeForSatker.isEmpty()) {
                    error("Geofence aktif untuk satker Anda tidak tersedia")
                }

                _state.value = _state.value.copy(
                    geofences = activeForSatker,
                    loading = false
                )

                // Kalau lokasi user sudah ada -> tentukan nearest + hitung jarak
                val s = _state.value
                val lat = s.userLat
                val lon = s.userLon
                val acc = s.accuracyM

                if (lat != null && lon != null && acc != null) {
                    selectNearestGeofenceStabilized(lat, lon, acc)
                    val fence = _state.value.geofence
                    if (fence != null) {
                        val d = distanceMeters(lat, lon, fence.latitude, fence.longitude)
                        _state.value = _state.value.copy(
                            distanceM = d,
                            insideArea = d <= fence.radius_meters.toDouble()
                        )
                    }
                }
            } catch (e: Throwable) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: "Gagal load geofence"
                )
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun refreshLocation() {
        val client = LocationServices.getFusedLocationProviderClient(app)

        // request id untuk memastikan hanya request terbaru yang menang
        val reqId = System.currentTimeMillis()
        locationRequestId = reqId

        // reset error
        _state.value = _state.value.copy(error = null)

        // 1) fallback cepat dari cache (lastLocation)
        try {
            client.lastLocation.addOnSuccessListener { loc ->
                if (loc != null && locationRequestId == reqId) {
                    applyLocation(loc)
                }
            }
        } catch (_: Throwable) {
        }

        // 2) lokasi utama (lebih akurat)
        try {
            val task = client.getCurrentLocation(
                com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                null
            )

            task.addOnSuccessListener { loc ->
                if (loc != null && locationRequestId == reqId) {
                    // lock: supaya callback lain yang telat gak override
                    locationRequestId = -1L
                    applyLocation(loc)
                }
            }.addOnFailureListener { e ->
                if (locationRequestId == reqId) {
                    _state.value = _state.value.copy(error = e.message ?: "Gagal ambil lokasi")
                }
            }
        } catch (e: Throwable) {
            _state.value = _state.value.copy(error = e.message ?: "Gagal ambil lokasi")
        }
    }

    private fun applyLocation(loc: Location) {

        val now = System.currentTimeMillis()

        val isMock = try { loc.isMockSafe() } catch (_: Throwable) { false }
        val ageMs = (now - loc.time).coerceAtLeast(0L)

        // update lokasi dulu
        _state.value = _state.value.copy(
            userLat = loc.latitude,
            userLon = loc.longitude,
            accuracyM = loc.accuracy.toDouble(),
            error = null,
            // ✅ audit lokasi
            isMock = isMock,
            provider = loc.provider,
            locationAgeMs = ageMs
        )

        // pilih geofence terdekat (stabil)
        selectNearestGeofenceStabilized(
            userLat = loc.latitude,
            userLon = loc.longitude,
            accuracyM = loc.accuracy.toDouble()
        )

        // hitung jarak berdasarkan geofence terbaru
        val s = _state.value
        val fence = s.geofence ?: return

        val d = distanceMeters(
            loc.latitude, loc.longitude,
            fence.latitude, fence.longitude
        )
        val inside = d <= fence.radius_meters.toDouble()

        _state.value = s.copy(
            distanceM = d,
            insideArea = inside
        )
    }

    fun distanceText(): String {
        val d = _state.value.distanceM ?: return "-"
        return if (d >= 1000) {
            val km = (d / 1000.0 * 10).roundToInt() / 10.0
            "$km km"
        } else "${d.roundToInt()} m"
    }

    fun canContinue(state: AttendanceMapUiState): Boolean {
        val hasLoc = state.userLat != null && state.userLon != null
        val accOk = (state.accuracyM ?: Double.MAX_VALUE) <= 50.0
        return hasLoc && accOk
    }

    private fun distanceMeters(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val result = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, result)
        return result[0].toDouble()
    }

    private fun selectNearestGeofenceStabilized(
        userLat: Double,
        userLon: Double,
        accuracyM: Double
    ) {
        val fences = _state.value.geofences
        if (fences.isEmpty()) return

        val now = System.currentTimeMillis()

        // 1) kalau akurasi jelek dan sudah ada current -> jangan ganti
        val current = _state.value.geofence
        if (current != null && accuracyM > maxAccuracyToSwitch) return

        val nearest = fences.minByOrNull { gf ->
            distanceMeters(userLat, userLon, gf.latitude, gf.longitude)
        } ?: return

        if (current == null) {
            _state.value = _state.value.copy(geofence = nearest)
            lastSwitchAtMs = now
            return
        }

        if (nearest.id == current.id) return

        // 2) cooldown
        if (now - lastSwitchAtMs < switchCooldownMs) return

        // 3) hysteresis
        val distCurrent = distanceMeters(userLat, userLon, current.latitude, current.longitude)
        val distNearest = distanceMeters(userLat, userLon, nearest.latitude, nearest.longitude)
        val improvement = distCurrent - distNearest

        if (improvement >= minImproveMeters) {
            _state.value = _state.value.copy(geofence = nearest)
            lastSwitchAtMs = now
        }
    }
}



/*
package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.annotation.SuppressLint
import android.app.Application
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.GeofenceModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

data class AttendanceMapUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val geofence: GeofenceModel? = null,
    val userLat: Double? = null,
    val userLon: Double? = null,
    val accuracyM: Double? = null,
    val distanceM: Double? = null,
    val insideArea: Boolean? = null,
    val geofences: List<GeofenceModel> = emptyList(),
)
*/




/*
@HiltViewModel
data class AttendanceMapViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val app: Application
) : ViewModel() {
    private val _state = MutableStateFlow(AttendanceMapUiState())
    val state: StateFlow<AttendanceMapUiState> = _state

    private var lastSwitchAtMs: Long = 0L
    private val switchCooldownMs: Long = 10_000L
    private val minImproveMeters: Double = 15.0
    private val maxAccuracyToSwitch: Double = 50.0

    private var locationRequestId: Long = 0L

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            try {
                val profile = tokenStore.getProfile()
                    ?: error("Profile tidak ditemukan, silakan login ulang")

                val res = api.geofences()
                val list = res.data ?: emptyList()

                */
/*val activeForSatker = list.firstOrNull {
                    it.is_active && it.satker.is_active &&
                            it.satker.id == profile.satkerId
                } ?: error("Geofence aktif untuk satker Anda tidak tersedia")*//*


                val activeForSatker = list.filter {
                    it.is_active &&
                            it.satker.is_active &&
                            it.satker.id == profile.satkerId
                }

                if (activeForSatker.isEmpty()) {
                    error("Geofence aktif untuk satker Anda tidak tersedia")
                }

                _state.value = _state.value.copy(
                    geofences = activeForSatker,
                    loading = false
                )

                // kalau lokasi user sudah ada, langsung tentukan nearest
                val lat = _state.value.userLat
                val lon = _state.value.userLon
                val acc = _state.value.accuracyM
                */
/*
                if (lat != null && lon != null) {
                    selectNearestGeofence(lat, lon)
                }

                 *//*


                if (lat != null && lon != null && acc != null) {
                    selectNearestGeofenceStabilized(lat, lon, acc)
                }


            } catch (e: Throwable) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: "Gagal load geofence"
                )
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun refreshLocation() {
        val client = LocationServices.getFusedLocationProviderClient(app)

        viewModelScope.launch {
            try {
                client.lastLocation.addOnSuccessListener { loc ->
                    if (loc != null) applyLocation(loc)
                }
            } catch (_: Throwable) {
            }
        }

        // paling akurat: getCurrentLocation (butuh google play services)

        viewModelScope.launch {
            try {
                val task = client.getCurrentLocation(
                    com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                    null
                )
                task.addOnSuccessListener { loc ->
                    if (loc != null) applyLocation(loc)
                }
            } catch (e: Throwable) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun applyLocation(loc: Location) {

        _state.value = _state.value.copy(
            userLat = loc.latitude,
            userLon = loc.longitude,
            accuracyM = loc.accuracy.toDouble()
        )

        //selectNearestGeofence(loc.latitude, loc.longitude)

        selectNearestGeofenceStabilized(
            userLat = loc.latitude,
            userLon = loc.longitude,
            accuracyM = loc.accuracy.toDouble()
        )

        */
/*val fence = _state.value.geofence ?: run {
            _state.value = _state.value.copy(
                userLat = loc.latitude,
                userLon = loc.longitude,
                accuracyM = loc.accuracy.toDouble()
            )

            return
        }*//*


        val fence = _state.value.geofence ?: return

        val d = distanceMeters(
            loc.latitude, loc.longitude,
            fence.latitude, fence.longitude
        )
        val inside = d <= fence.radius_meters.toDouble()

        _state.value = _state.value.copy(
            distanceM = d,
            insideArea = inside
        )


        */
/*val result = FloatArray(1)

        Location.distanceBetween(
            loc.latitude, loc.longitude,
            fence.latitude, fence.longitude,
            result
        )

        val d = result[0].toDouble()
        val inside = d <= fence.radius_meters.toDouble()

        _state.value = _state.value.copy(
            userLat = loc.latitude,
            userLon = loc.longitude,
            accuracyM = loc.accuracy.toDouble(),
            distanceM = d,
            insideArea = inside
        )*//*

    }

    fun distanceText(): String {
        val d = _state.value.distanceM ?: return "-"
        return if (d >= 1000) {
            val km = (d / 1000.0 * 10).roundToInt() / 10.0
            "$km km"
        } else "${d.roundToInt()} m"
    }

    fun canContinue(state: AttendanceMapUiState): Boolean {
        val hasLoc = state.userLat != null && state.userLon != null
        val accOk = (state.accuracyM ?: Double.MAX_VALUE) <= 50.0
        return hasLoc && accOk
    }

    private fun selectNearestGeofence(userLat: Double, userLon: Double) {
        val fences = _state.value.geofences
        if (fences.isEmpty()) return

        val nearest = fences.minByOrNull { gf ->
            distanceMeters(userLat, userLon, gf.latitude, gf.longitude)
        }

        _state.value = _state.value.copy(geofence = nearest)
    }

    private fun distanceMeters(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val result = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, result)
        return result[0].toDouble()
    }

    private fun selectNearestGeofenceStabilized(
        userLat: Double,
        userLon: Double,
        accuracyM: Double
    ) {
        val fences = _state.value.geofences
        if (fences.isEmpty()) return

        val now = System.currentTimeMillis()

        // 1) Accuracy gate: kalau akurasi jelek, jangan ganti (tapi kalau belum ada geofence, tetap pilih)
        val current = _state.value.geofence
        if (current != null && accuracyM > maxAccuracyToSwitch) {
            return
        }

        val nearest = fences.minByOrNull { gf ->
            distanceMeters(userLat, userLon, gf.latitude, gf.longitude)
        } ?: return

        // kalau belum ada current, langsung set
        if (current == null) {
            _state.value = _state.value.copy(geofence = nearest)
            lastSwitchAtMs = now
            return
        }

        // kalau sama, tidak perlu apa-apa
        if (nearest.id == current.id) return

        // 2) Cooldown
        if (now - lastSwitchAtMs < switchCooldownMs) {
            return
        }

        // 3) Hysteresis: nearest harus "lebih baik" sekian meter dari current
        val distCurrent = distanceMeters(userLat, userLon, current.latitude, current.longitude)
        val distNearest = distanceMeters(userLat, userLon, nearest.latitude, nearest.longitude)

        val improvement = distCurrent - distNearest // positif kalau nearest lebih dekat

        if (improvement >= minImproveMeters) {
            _state.value = _state.value.copy(geofence = nearest)
            lastSwitchAtMs = now
        }
    }


}
*/
