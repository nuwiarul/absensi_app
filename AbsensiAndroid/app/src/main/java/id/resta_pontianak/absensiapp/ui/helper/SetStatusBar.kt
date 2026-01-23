package id.resta_pontianak.absensiapp.ui.helper

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

@Composable
public fun SetStatusBarBlueWithWhiteIcons(color: Color) {
    val view = LocalView.current
    val activity = view.context as Activity
    val window = activity.window

    DisposableEffect(color) {
        // background status bar
        window.statusBarColor = color.toArgb()

        // ikon status bar jadi putih
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = false  // ✅ WHITE ICONS

        onDispose { }
    }
}

@Composable
fun SetStatusBar(
    color: Color,
    darkIcons: Boolean
) {
    val view = LocalView.current
    val activity = view.context as Activity
    val window = activity.window

    DisposableEffect(color, darkIcons) {
        // ✅ WARNA (walau deprecated, ini masih cara resmi)
        @Suppress("DEPRECATION")
        window.statusBarColor = color.toArgb()

        // ✅ ICON (cara modern)
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = darkIcons

        onDispose { }
    }
}