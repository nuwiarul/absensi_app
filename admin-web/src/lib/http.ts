import axios from "axios"
import { getToken, clearSession } from "./auth"

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"

/*export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "https://api.resta-pontianak.my.id/api"*/

export const http = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30_000,
})

http.interceptors.request.use((config) => {
    config.headers = config.headers ?? {}
    config.headers["X-Client-Channel"] = "web" // ✅ wajib
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

http.interceptors.response.use(
    (r) => r,
    (err) => {
        const status = err?.response?.status
        if (status === 401 || status === 403) {
            clearSession()
            // biarkan router handle redirect dengan ProtectedRoute
        }
        return Promise.reject(err)
    }
)
