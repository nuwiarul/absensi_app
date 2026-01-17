package id.resta_pontianak.absensiapp.data.auth

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object AuthEventBus {
    private val _events = MutableSharedFlow<AuthEvent>(extraBufferCapacity = 1)
    val events = _events.asSharedFlow()

    fun emit(event: AuthEvent) {
        _events.tryEmit(event)
    }
}