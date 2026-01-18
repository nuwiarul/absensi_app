import { http } from "@/lib/http"
import type { GenerateCalendarResp } from "./types"

export async function generateCalendar(satkerId: string, from: string, to: string): Promise<number> {
  const res = await http.post<GenerateCalendarResp>(`/satkers/${satkerId}/calendar/generate`, null, {
    params: { from, to },
  })
  return res.data.data.days_generated
}
