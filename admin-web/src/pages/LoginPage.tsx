import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { http } from "@/lib/http.ts"
import { setSession, isAdminRole } from "@/lib/auth"
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {apiErrorMessage} from "@/lib/api-error.ts";

type LoginResp = {
    status: string
    data: {
        id: string
        nrp: string
        full_name: string
        token: string
        satker_id: string
        role: "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"
        satker_name: string
        satker_code: string
    }
    message?: string
}

export default function LoginPage() {
    const nav = useNavigate()

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    async function onSubmit() {
        if (!username.trim() || !password) {
            //toast({ variant: "destructive", title: "Gagal", description: "Username & password wajib diisi" })
            toast.error("Username & password wajib diisi")
            return
        }
        setLoading(true)
        try {
            const res = await http.post<LoginResp>("/auth/login", {
                username: username.trim(),
                password,
            })

            if (res.data.status !== "200" || !res.data.data) {
                throw new Error(res.data.message || "Login gagal")
            }

            const d = res.data.data
            if (!isAdminRole(d.role)) {
                toast.error("Role Anda tidak boleh login melalui web.")
                return
            }

            setSession({
                token: d.token,
                userId: d.id,
                nrp: d.nrp,
                fullName: d.full_name,
                role: d.role,
                satkerId: d.satker_id,
                satkerName: d.satker_name,
                satkerCode: d.satker_code,
            })

            nav("/", { replace: true })
        } catch (e: unknown) {
            //toast({ variant: "destructive", title: "Login gagal", description: apiErrorMessage(e) })
            toast.error(apiErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo_pontianak.png"
                            alt="Logo Polresta Pontianak Kota"
                            className="h-10 w-10"
                        />
                        <div>
                            <CardTitle>Login Admin</CardTitle>
                            <div className="text-sm text-muted-foreground">Polresta Pontianak Kota</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={onSubmit} disabled={loading}>
                        {loading ? "Loading..." : "Login"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        Hanya <b>SUPERADMIN</b> & <b>SATKER_ADMIN</b> yang bisa login web.
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
