package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.location.Location
import android.os.Build

/**
 * Safe mock location detection.
 * - Compatible with all Android versions
 * - Avoids crash & suppresses deprecation warning
 */
@Suppress("DEPRECATION")
fun Location.isMockSafe(): Boolean {
    return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // API 31+ (Android 12)
            this.isMock
        } else {
            // API lama
            this.isFromMockProvider
        }
    } catch (_: Throwable) {
        false
    }
}
