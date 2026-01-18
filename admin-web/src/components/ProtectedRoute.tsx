import { Navigate, Outlet } from "react-router-dom"
import { getSession, isAdminRole } from "@/lib/auth"

export default function ProtectedRoute() {
    const s = getSession()
    if (!s) return <Navigate to="/login" replace />
    if (!isAdminRole(s.role)) return <Navigate to="/login" replace />
    return <Outlet />
}
