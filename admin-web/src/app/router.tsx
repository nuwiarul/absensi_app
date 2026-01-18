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
                    { path: "/holidays", element: <HolidaysBulkPage /> },
                    { path: "/settings", element: <SettingsPage /> },
                    /*{ path: "/working-days", element: <WorkPatternsPage /> },*/
                ],
            },
        ],
    },
])
