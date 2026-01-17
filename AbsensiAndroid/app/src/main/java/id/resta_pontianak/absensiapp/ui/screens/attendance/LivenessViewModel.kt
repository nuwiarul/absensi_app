package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

data class LivenessUiState(
    val message: String = "Arahkan wajah ke kamera",
    val progress: Float = 0f,           // 0..1 (progress liveness)
    val faceDetected: Boolean = false,
    val blinkCount: Int = 0,
    val readyToCapture: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LivenessViewModel @Inject constructor() : ViewModel() {
    private val _state = MutableStateFlow(LivenessUiState())
    val state: StateFlow<LivenessUiState> = _state

    // Blink state machine
    private var eyesWereOpen = false
    private var eyesWereClosed = false
    private var lastBlinkAtMs: Long = 0L

    // tuning
    private val openThresh = 0.70f
    private val closedThresh = 0.25f
    private val blinkCooldownMs = 700L

    fun onNoFace() {
        _state.value = _state.value.copy(
            faceDetected = false,
            message = "Wajah belum terdeteksi. Dekatkan wajah & pastikan terang.",
            error = null
        )
    }

    fun onFace(
        leftEyeOpenProb: Float?,
        rightEyeOpenProb: Float?
    ) {
        _state.value = _state.value.copy(faceDetected = true, error = null)

        // kalau MLKit belum bisa klasifikasi (null), beri instruksi
        if (leftEyeOpenProb == null || rightEyeOpenProb == null) {
            _state.value = _state.value.copy(
                message = "Tahan posisi... (deteksi mata belum siap)"
            )
            return
        }

        val now = System.currentTimeMillis()
        val avg = (leftEyeOpenProb + rightEyeOpenProb) / 2f

        // update message dasar
        _state.value = _state.value.copy(
            message = if (_state.value.blinkCount >= 1) "Bagus! Tahan sebentar..." else "Kedipkan mata sekali"
        )

        // state machine blink: open -> closed -> open
        val isOpen = avg >= openThresh
        val isClosed = avg <= closedThresh

        if (isOpen) {
            if (!eyesWereOpen) {
                eyesWereOpen = true
                eyesWereClosed = false
            } else {
                // jika sebelumnya sudah closed dan sekarang open lagi -> blink selesai
                if (eyesWereClosed && now - lastBlinkAtMs > blinkCooldownMs) {
                    lastBlinkAtMs = now
                    eyesWereClosed = false

                    val newCount = _state.value.blinkCount + 1
                    val prog = min(1f, newCount / 1f) // target 1 blink (ubah jadi /2f kalau mau 2 blink)
                    _state.value = _state.value.copy(
                        blinkCount = newCount,
                        progress = prog,
                        readyToCapture = newCount >= 1,
                        message = if (newCount >= 1) "Liveness OK ✅" else _state.value.message
                    )
                }
            }
        } else if (isClosed) {
            if (eyesWereOpen) {
                eyesWereClosed = true
            }
        } else {
            // intermediate, do nothing
            _state.value = _state.value.copy(
                progress = max(_state.value.progress, 0.2f)
            )
        }

    }

    fun onCaptureError(msg: String) {
        _state.value = _state.value.copy(error = msg)
    }

}