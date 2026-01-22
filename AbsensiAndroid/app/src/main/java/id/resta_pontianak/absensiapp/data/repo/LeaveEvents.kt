package id.resta_pontianak.absensiapp.data.repo

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object LeaveEvents {
    private val _changes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val changes = _changes.asSharedFlow()

    fun emitChanged() {
        _changes.tryEmit(Unit)
    }

}
