package id.resta_pontianak.absensiapp.di

import android.content.Context
import coil.ImageLoader
import coil.util.DebugLogger
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import id.resta_pontianak.absensiapp.data.local.DeviceIdProvider
import id.resta_pontianak.absensiapp.data.local.SettingsStore
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.local.TukinStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.AuthInterceptor
import id.resta_pontianak.absensiapp.data.network.ClientChannelInterceptor
import id.resta_pontianak.absensiapp.data.network.DeviceIdInterceptor
import id.resta_pontianak.absensiapp.data.network.ProfileUrlProvider
import id.resta_pontianak.absensiapp.data.network.ProfileUrlProviderImpl
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProvider
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProviderImpl
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.data.repo.AuthRepository
import id.resta_pontianak.absensiapp.data.repo.DutyScheduleRepository
import id.resta_pontianak.absensiapp.data.repo.LeaveRepository
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import id.resta_pontianak.absensiapp.data.repo.TukinRepository
import id.resta_pontianak.absensiapp.data.repo.ApelRepository
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    //private const val BASE_URL = "http://10.0.2.2:8000/api/"

    private const val BASE_URL = "https://api.resta-pontianak.my.id/api/"

    @Provides
    @Singleton
    @Named("ApiBaseUrl")
    fun provideApiBaseUrl(): String = BASE_URL

    @Provides
    @Singleton
    fun provideTokenStore(@ApplicationContext ctx: Context): TokenStore = TokenStore(ctx)

    @Provides
    @Singleton
    fun provideDeviceIdProvider(@ApplicationContext context: Context): DeviceIdProvider {
        return DeviceIdProvider(context)
    }


    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenStore: TokenStore): AuthInterceptor = AuthInterceptor(tokenStore)

    @Provides
    @Singleton
    fun provideClientChannelInterceptor(): ClientChannelInterceptor = ClientChannelInterceptor()

    @Provides
    @Singleton
    fun provideDeviceIdInterceptor(
        deviceIdProvider: DeviceIdProvider
    ): DeviceIdInterceptor = DeviceIdInterceptor(deviceIdProvider)


    @Provides
    @Singleton
    fun provideOkHttp(
        authInterceptor: AuthInterceptor,
        clientChannelInterceptor: ClientChannelInterceptor,
        deviceIdInterceptor : DeviceIdInterceptor
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(clientChannelInterceptor)
            .addInterceptor(deviceIdInterceptor)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttp: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttp)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService =
        retrofit.create(ApiService::class.java)

    @Provides
    @Singleton
    fun provideAuthRepository(api: ApiService, tokenStore: TokenStore): AuthRepository =
        AuthRepository(api, tokenStore)

    @Provides
    @Singleton
    fun provideAttendanceRepository(api: ApiService): AttendanceRepository =
        AttendanceRepository(api)


    @Provides
    @Singleton
    fun provideSelfieUrlProvider(
        impl: SelfieUrlProviderImpl
    ): SelfieUrlProvider = impl

    @Provides
    @Singleton
    fun provideProfileUrlProvider(
        impl: ProfileUrlProviderImpl
    ): ProfileUrlProvider = impl

    @Provides
    @Singleton
    fun provideCoilImageLoader(
        @ApplicationContext context: Context,
        okHttpClient: OkHttpClient
    ): ImageLoader {
        return ImageLoader.Builder(context)
            .okHttpClient(okHttpClient) // ✅ ini yang penting: token ikut!
            .logger(DebugLogger())      // optional: lihat log error coil
            .build()
    }

    @Provides
    @Singleton
    fun provideLeaveRepository(api: ApiService): LeaveRepository = LeaveRepository(api)

    @Provides
    @Singleton
    fun provideSettingsStore(@ApplicationContext ctx: Context): SettingsStore = SettingsStore(ctx)

    @Provides
    @Singleton
    fun provideSettingsRepository(api: ApiService, store: SettingsStore): SettingsRepository =
        SettingsRepository(api, store)

    @Provides
    @Singleton
    fun provideTukinRepository(api: ApiService, tokenStore: TokenStore): TukinRepository =
        TukinRepository(api, tokenStore)

    @Provides
    @Singleton
    fun provideDutyScheduleRepository(api: ApiService, tokenStore: TokenStore): DutyScheduleRepository =
        DutyScheduleRepository(api, tokenStore)

    @Provides
    @Singleton
    fun provideTukinStore(@ApplicationContext ctx: Context): TukinStore = TukinStore(ctx)

    @Provides
    @Singleton
    fun provideApelRepository(api: ApiService): ApelRepository =
        ApelRepository(api)

}