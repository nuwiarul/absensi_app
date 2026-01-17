package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButtonDefaults.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale

private const val TAG = "Liveness"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivenessScreen(
    state: LivenessUiState,
    hasCameraPermission: Boolean,
    onBack: () -> Unit,
    onFace: (leftEyeProb: Float?, rightEyeProb: Float?) -> Unit,
    onNoFace: () -> Unit,
    onCaptureError: (String) -> Unit,
    onCaptured: (photoPath: String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var previewView: PreviewView? by remember { mutableStateOf(null) }
    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }
    var bound by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Selfie & Liveness", color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0B2A5A))
            )
        }
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color.Black)
        ) {
            if (!hasCameraPermission) {
                Text(
                    "Meminta izin kamera...",
                    color = Color.White,
                    modifier = Modifier.align(Alignment.Center)
                )
                return@Box
            }

            // ===== Preview =====
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        previewView = this
                    }
                },
                update = { pv ->
                    if (!bound) {
                        bindCamera(
                            context = context,
                            lifecycleOwner = lifecycleOwner,
                            previewView = pv,
                            onAnalyzer = { l, r -> onFace(l, r) },
                            onNoFace = onNoFace,
                            onCaptureReady = { cap -> imageCapture = cap },
                            onError = onCaptureError
                        )
                        bound = true
                    }
                }
            )

            // ===== Overlay bottom info =====

            Card(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(state.message, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))

                    LinearProgressIndicator(
                        progress = { state.progress },
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (state.error != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(state.error, color = MaterialTheme.colorScheme.error)
                    }

                    Spacer(Modifier.height(12.dp))

                    Button(
                        onClick = {
                            val cap = imageCapture
                            if (cap == null) {
                                onCaptureError("Camera belum siap")
                                return@Button
                            }
                            if (!state.readyToCapture) {
                                onCaptureError("Liveness belum terpenuhi (kedipkan mata)")
                                return@Button
                            }
                            takePhoto(
                                context = context,
                                imageCapture = cap,
                                onCaptured = onCaptured,
                                onError = onCaptureError
                            )
                        },
                        enabled = state.readyToCapture && imageCapture != null,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                    ) {
                        Text("Ambil Foto Selfie")
                    }

                }
            }


        }

    }
}

@SuppressLint("UnsafeOptInUsageError")
private fun bindCamera(
    context: Context,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    previewView: PreviewView,
    onAnalyzer: (Float?, Float?) -> Unit,
    onNoFace: () -> Unit,
    onCaptureReady: (ImageCapture) -> Unit,
    onError: (String) -> Unit
) {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    cameraProviderFuture.addListener({
        val cameraProvider = cameraProviderFuture.get()

        val preview = Preview.Builder()
            .build()
            .also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

        val imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()

        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setMinFaceSize(0.15f)
            .enableTracking()
            .build()

        val detector = FaceDetection.getClient(options)

        analysis.setAnalyzer(
            ContextCompat.getMainExecutor(context),
            object : ImageAnalysis.Analyzer {
                private var busy = false

                override fun analyze(imageProxy: ImageProxy) {
                    if (busy) {
                        imageProxy.close()
                        return
                    }

                    val mediaImage = imageProxy.image
                    if (mediaImage == null) {
                        imageProxy.close()
                        return
                    }

                    busy = true

                    val input = InputImage.fromMediaImage(
                        mediaImage,
                        imageProxy.imageInfo.rotationDegrees
                    )

                    detector.process(input)
                        .addOnSuccessListener {
                            faces ->
                            if (faces.isNullOrEmpty()) {
                                onNoFace()
                            } else {
                                val face = faces.maxBy { it.boundingBox.width() * it.boundingBox.height() }
                                onAnalyzer(face.leftEyeOpenProbability, face.rightEyeOpenProbability)
                            }
                        }
                        .addOnFailureListener { e -> Log.e(TAG, "MLKit error", e)  }
                        .addOnCompleteListener {
                            busy = false
                            imageProxy.close()
                        }
                }
            }
        )

        try {
            cameraProvider.unbindAll()

            val selector = CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                .build()

            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                selector,
                preview,
                imageCapture,
                analysis
            )

            onCaptureReady(imageCapture)
        } catch (e: Exception) {
            onError("Gagal bind camera: ${e.message}")
        }

    }, ContextCompat.getMainExecutor(context))
}

private fun takePhoto(
    context: Context,
    imageCapture: ImageCapture,
    onCaptured: (String) -> Unit,
    onError: (String) -> Unit
) {
    val dir = File(context.cacheDir, "selfies").apply { mkdirs() }
    val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
    val file = File(dir, "selfie_$ts.jpg")

    val output = ImageCapture.OutputFileOptions.Builder(file).build()

    imageCapture.takePicture(
        output,
        ContextCompat.getMainExecutor(context),
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                Log.d("Liveness", "Saved to: ${file.absolutePath}")
                onCaptured(file.absolutePath)
            }

            override fun onError(exception: ImageCaptureException) {
                Log.e("Liveness", "Capture error", exception)
                onError("Gagal ambil foto: ${exception.message}")
            }
        }
    )
}