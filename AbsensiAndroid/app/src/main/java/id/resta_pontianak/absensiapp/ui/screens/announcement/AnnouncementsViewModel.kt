package id.resta_pontianak.absensiapp.ui.screens.announcement

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.AnnouncementDto
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

data class AnnouncementUi(
    val id: String,
    val title: String,
    val body: String,
    val scopeLabel: String,
    val dateLabel: String,
)

@HiltViewModel
class AnnouncementsViewModel @Inject constructor(
    private val api: ApiService,
    private val settingsRepo: SettingsRepository
) : ViewModel() {

    data class State(
        val isLoading: Boolean = false,
        val error: String? = null,
        val items: List<AnnouncementUi> = emptyList()
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
    }

    fun consumeError() = _state.update { it.copy(error = null) }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val tzName = settingsRepo.getTimezoneCached()
                val zone = ZoneId.of(tzName)
                val fmt = DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy", Locale("id","ID"))

                val res = api.announcements()
                val list = res.data ?: emptyList()

                // sort newest & limit 10
                val mapped = list
                    .sortedByDescending { it.created_at }
                    .take(10)
                    .map { it.toUi(zone, fmt) }

                _state.update { it.copy(isLoading = false, items = mapped) }
            } catch (e: Throwable) {
                _state.update { it.copy(isLoading = false, error = ApiErrorParser.parse(e)) }
            }
        }
    }
}

private fun AnnouncementDto.toUi(
    zone: ZoneId,
    fmt: DateTimeFormatter
): AnnouncementUi {
    val created = try { Instant.parse(created_at).toEpochMilliseconds() } catch (_: Throwable) { 0L }
    val dateLabel = try {
        java.time.Instant.ofEpochMilli(created).atZone(zone).format(fmt)
    } catch (_: Throwable) {
        created_at
    }

    val scopeLabel = when (scope.trim().uppercase()) {
        "GLOBAL" -> "GLOBAL"
        "SATKER" -> {
            val satker = listOfNotNull(satker_name, satker_code?.let { "($it)" }).joinToString(" ")
            if (satker.isBlank()) "SATKER" else "SATKER $satker"
        }
        else -> scope
    }

    return AnnouncementUi(
        id = id,
        title = title,
        body = body,
        scopeLabel = scopeLabel,
        dateLabel = dateLabel
    )
}
