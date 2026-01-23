package id.resta_pontianak.absensiapp.ui.screens.account

import android.util.Log
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.ImageLoader
import coil.compose.AsyncImage
import id.resta_pontianak.absensiapp.R

import androidx.compose.material.icons.filled.PhotoCamera   // ✅ ADD
import androidx.compose.material3.CircularProgressIndicator // ✅ ADD
import androidx.compose.material.icons.filled.Lock
import androidx.compose.foundation.lazy.LazyColumn // ✅ ADD
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.TextButton
import androidx.compose.ui.unit.sp

private val BlueHeader = Color(0xFF0B2A5A)
private val CardBlue = Color(0xFF123D8A)
private val CardBlueDim = Color(0xFF0F2F68)

@Composable
fun AccountScreen(
    fullName: String,
    nrp: String,
    hadirHari: Int,
    tidakHadirHari: Int,
    tunkinNominal: String,
    tunkinUpdatedAtText: String?,
    isTunkinStale: Boolean,
    isTunkinLoading: Boolean,
    onRefreshTunkin: () -> Unit,
    profilePhotoKey: String?,
    onInformasiProfil: () -> Unit,
    onRiwayatPerizinan: () -> Unit,
    onRiwayatKehadiran: () -> Unit,
    onRiwayatTunkin: () -> Unit,
    onJadwalDinas: () -> Unit,
    pendingDutySubmittedCount: Int,
    onLogout: () -> Unit,
    profileUrl: (String) -> String,
    imageLoader: ImageLoader,
    onClickChangePhoto: () -> Unit,
    isUploading: Boolean,
    onChangePassword: () -> Unit,
    leaveSubmittedBadgeCount: Int = 0,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F7FB))
    ) {
        AccountHeader(
            fullName = fullName,
            nrp = nrp,
            hadirHari = hadirHari,
            tidakHadirHari = tidakHadirHari,
            tunkinNominal = tunkinNominal,
            tunkinUpdatedAtText = tunkinUpdatedAtText,
            isTunkinStale = isTunkinStale,
            isTunkinLoading = isTunkinLoading,
            onRefreshTunkin = onRefreshTunkin,
            profilePhotoKey = profilePhotoKey,
            profileUrl = profileUrl,
            imageLoader = imageLoader,
            onClickChangePhoto = onClickChangePhoto,
            isUploading = isUploading
        )

        Spacer(Modifier.height(10.dp))

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()                 // ✅ penting: biar ngisi sisa layar dan bisa scroll
                .padding(horizontal = 12.dp),
            contentPadding = PaddingValues(bottom = 16.dp), // ✅ biar tidak mepet bawah
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item { MenuRow("Informasi Profil", Icons.Filled.Person, onInformasiProfil) }

            item { MenuRow("Riwayat Perizinan", Icons.Filled.ReceiptLong, onRiwayatPerizinan, badgeCount = leaveSubmittedBadgeCount) }

            item { MenuRow("Riwayat Kehadiran", Icons.Filled.Schedule, onRiwayatKehadiran) }

            item { MenuRow("Riwayat Tunjangan Kinerja", Icons.Filled.Payments, onRiwayatTunkin) }

            item { MenuRow("Jadwal Dinas", Icons.Filled.CalendarMonth, onJadwalDinas, badgeCount = pendingDutySubmittedCount) }

            item { MenuRow("Change Password", Icons.Filled.Lock, onChangePassword) }

            item { MenuRow("Logout", Icons.Filled.ExitToApp, onLogout, danger = true) }
        }
    }
}

@Composable
private fun AccountHeader(
    fullName: String,
    nrp: String,
    profilePhotoKey: String?,
    hadirHari: Int,
    tidakHadirHari: Int,
    tunkinNominal: String,
    tunkinUpdatedAtText: String?,
    isTunkinStale: Boolean,
    isTunkinLoading: Boolean,
    onRefreshTunkin: () -> Unit,
    profileUrl: (String) -> String,
    imageLoader: ImageLoader,
    onClickChangePhoto: () -> Unit,
    isUploading: Boolean

) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BlueHeader)
            .padding(top = 20.dp, bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {


        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        )  {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // ✅ CHANGE: avatar + tombol kecil ubah foto
                Box(
                    modifier = Modifier.size(110.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (!profilePhotoKey.isNullOrBlank()) {
                        AsyncImage(
                            model = profileUrl(profilePhotoKey),
                            imageLoader = imageLoader,
                            contentDescription = "Foto Profil",
                            modifier = Modifier
                                .size(96.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.15f), CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Image(
                            painter = painterResource(id = R.drawable.logo_pontianak),
                            contentDescription = "Foto Profil",
                            modifier = Modifier
                                .size(96.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.15f), CircleShape)
                                .padding(10.dp),
                            contentScale = ContentScale.Fit
                        )
                    }

                    // ✅ ADD: loading kecil saat upload
                    if (isUploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            strokeWidth = 3.dp,
                            color = Color.White
                        )
                    }

                    // ✅ ADD: tombol kecil ubah foto (pojok kanan bawah)
                    Surface(
                        shape = CircleShape,
                        color = Color.White,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(34.dp)
                            .clickable(enabled = !isUploading) { onClickChangePhoto() }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.PhotoCamera,
                                contentDescription = "Ubah Foto Profil",
                                tint = BlueHeader,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }



                Spacer(Modifier.height(10.dp))

                Text(
                    text = fullName,
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )

                Spacer(Modifier.height(4.dp))

                Text(
                    text = nrp,
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Spacer(Modifier.width(14.dp))

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(Modifier.fillMaxWidth(), "${hadirHari} Hari", "Hadir", CardBlueDim)
                StatCard(Modifier.fillMaxWidth(), "${tidakHadirHari} Hari", "Tidak Hadir", CardBlueDim)
            }
        }




        Spacer(Modifier.height(12.dp))

        /*Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {


            *//*TukinStatCard(
                modifier = Modifier.weight(1f),
                nominal = tunkinNominal,
                updatedAtText = tunkinUpdatedAtText,
                isStale = isTunkinStale,
                isLoading = isTunkinLoading,
                onRefresh = onRefreshTunkin
            )*//*
            //StatCard(Modifier.weight(1f), tunkinNominal, "Tunkin", CardBlue)
        }*/

        TukinWideCard(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            nominal = tunkinNominal,
            updatedAtText = tunkinUpdatedAtText,
            isStale = isTunkinStale,
            isLoading = isTunkinLoading,
            onRefresh = onRefreshTunkin
        )
    }
}

@Composable
private fun TukinStatCard(
    modifier: Modifier,
    nominal: String,
    updatedAtText: String?,
    isStale: Boolean,
    isLoading: Boolean,
    onRefresh: () -> Unit
) {
    Card(
        modifier = modifier.height(78.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(CardBlue)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = nominal,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleSmall, // 🔽 lebih kecil dari sebelumnya
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Text(
                    text = "Tunkin",
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 10.sp // 🔽 diperkecil manual
                    )
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (isStale) "Perlu diperbarui" else (updatedAtText ?: ""),
                    color = Color.White.copy(alpha = if (isStale) 1f else 0.65f),
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 9.sp // 🔽 lebih subtle
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // tombol kecil / icon kecil, tidak mengganggu layout menu lain
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .clickable(enabled = !isLoading) { onRefresh() }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(12.dp),
                            strokeWidth = 1.5.dp,
                            color = Color.White
                        )
                    } else {
                        Text(
                            text = "Perbarui",
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 9.sp
                            ),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TukinWideCard(
    modifier: Modifier,
    nominal: String,
    updatedAtText: String?,
    isStale: Boolean,
    isLoading: Boolean,
    onRefresh: () -> Unit
) {
    Card(
        modifier = modifier.height(74.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(CardBlue)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = nominal,
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "Tunkin",
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.labelSmall
                )
                Text(
                    text = if (isStale) "Perlu diperbarui" else (updatedAtText ?: ""),
                    color = Color.White.copy(alpha = if (isStale) 1f else 0.7f),
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.width(10.dp))

            // tombol kecil di kanan
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = Color.White
                )
            } else {
                TextButton(
                    onClick = onRefresh,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Perbarui",
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}



@Composable
private fun StatCard(
    modifier: Modifier,
    value: String,
    label: String,
    container: Color
) {
    Card(
        modifier = modifier.height(78.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(container)
                .padding(10.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = value,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = label,
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun MenuRow(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    badgeCount: Int? = null,
    danger: Boolean = false
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(BlueHeader)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = CircleShape,
                color = Color.White,
                modifier = Modifier.size(36.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = BlueHeader,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(Modifier.width(14.dp))

            Text(
                text = title,
                color = if (danger) Color(0xFFFFE4E6) else Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.weight(1f))

            val bc = badgeCount ?: 0
            if (bc > 0) {
                val label = if (bc > 99) "99+" else bc.toString()
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xFFE53935)
                ) {
                    Text(
                        text = label,
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
        }
    }
}
