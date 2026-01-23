package id.resta_pontianak.absensiapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import dagger.hilt.android.AndroidEntryPoint
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiClient
import id.resta_pontianak.absensiapp.data.repo.AuthRepository
import id.resta_pontianak.absensiapp.ui.navigation.AppNav
import id.resta_pontianak.absensiapp.ui.screens.auth.LoginScreen
import id.resta_pontianak.absensiapp.ui.screens.auth.LoginViewModel
import id.resta_pontianak.absensiapp.ui.theme.AbsensiAppTheme
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)


        //WindowCompat.setDecorFitsSystemWindows(window, false)

        //window.statusBarColor = android.graphics.Color.TRANSPARENT

        //WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        //enableEdgeToEdge()
        setContent {
            AbsensiAppTheme {

                AppNav(
                    tokenStore = tokenStore
                )

                /*
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Greeting(
                        name = "Android",
                        modifier = Modifier.padding(innerPadding)
                    )
                }

                 */
                /*Surface(color = MaterialTheme.colorScheme.background) {
                    val state by vm.state.collectAsState()

                    var loggedinProfile by remember { mutableStateOf<String?>(null) }
                    val scope = rememberCoroutineScope()

                    if (loggedinProfile == null) {
                        LoginScreen(
                            state = state,
                            onUsernameChange = vm::onUsernameChange,
                            onPasswordChange = vm::onPasswordChange,
                            onLoginClick = {
                                vm.login(onSuccess = {
                                    scope.launch {
                                        val p = tokenStore.getProfile()
                                        loggedinProfile = if (p != null) {
                                            "Login OK: ${p.fullName} (${p.nrp})"
                                        } else {
                                            "Login OK: (Profile null)"
                                        }
                                    }
                                })
                            }
                        )
                    } else {
                        Text(
                            text = loggedinProfile!!,
                            modifier = androidx.compose.ui.Modifier.padding(16.dp)
                        )
                    }
                }*/
            }
        }
    }
}

/*
@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    AbsensiAppTheme {
        Greeting("Android")
    }
}*/
