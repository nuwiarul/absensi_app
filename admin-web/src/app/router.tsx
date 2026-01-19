import { createBrowserRouter } from "react-router-dom"
import ProtectedRoute from "@/components/ProtectedRoute"
import AppShell from "@/components/AppShell"
import LoginPage from "@/pages/LoginPage"
import SatkersPage from "@/pages/SatkersPage";
import UsersPage from "@/pages/UsersPage"
import SatkerHeadsPage from "@/pages/SatkerHeadsPage"
import GeofencesPage from "@/pages/GeofencesPage"
import WorkPatternsPage from "@/pages/WorkPatternsPage"
import CalendarGeneratePage from "@/pages/CalendarGeneratePage"
import CalendarResultPage from "@/pages/CalendarResultPage"
import HolidaysBulkPage from "@/pages/HolidaysBulkPage"
import SettingsPage from "@/pages/SettingsPage"
import RanksPage from "@/pages/RanksPage"
import AttendanceRecapPage from "@/pages/AttendanceRecapPage"
import AttendanceManagePage from "@/pages/AttendanceManagePage"
import LeaveRequestsPage from "@/pages/LeaveRequestsPage"
import DutySchedulesPage from "@/pages/DutySchedulesPage"
import TukinCalculationsPage from "@/pages/TukinCalculationsPage"
import TukinPolicyPage from "@/pages/TukinPolicyPage"
//import WorkPatternsPage from "@/pages/WorkPatternsPage"*/

export const router = createBrowserRouter([
    { path: "/login", element: <LoginPage /> },

    {
        element: <ProtectedRoute />,
        children: [
            {
                element: <AppShell />,
                children: [
                    { path: "/", element: <SatkersPage /> },
                    { path: "/satkers", element: <SatkersPage /> },
                    { path: "/users", element: <UsersPage /> },
                    { path: "/satker-heads", element: <SatkerHeadsPage /> },
                    { path: "/geofences", element: <GeofencesPage /> },
                    { path: "/work-patterns", element: <WorkPatternsPage /> },
                    { path: "/calendar-generate", element: <CalendarGeneratePage /> },
                    { path: "/calendar/result", element: <CalendarResultPage /> },
                    { path: "/attendance/recap", element: <AttendanceRecapPage /> },
                    { path: "/attendance/manage", element: <AttendanceManagePage /> },
                    { path: "/leave-requests", element: <LeaveRequestsPage /> },
                    { path: "/holidays", element: <HolidaysBulkPage /> },
                    { path: "/duty-schedules", element: <DutySchedulesPage /> },
                    { path: "/tukin/calculations", element: <TukinCalculationsPage /> },
                    { path: "/tukin/policies", element: <TukinPolicyPage /> },
                    { path: "/ranks", element: <RanksPage /> },
                    { path: "/settings", element: <SettingsPage /> },
                    /*{ path: "/working-days", element: <WorkPatternsPage /> },*/
                ],
            },
        ],
    },
])
