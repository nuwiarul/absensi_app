import { http } from "@/lib/http"
import type { GenerateCalendarResp, ListCalendarResp } from "./types"

export async function generateCalendar(satkerId: string, from: string, to: string): Promise<number> {
  const res = await http.post<GenerateCalendarResp>(`/satkers/${satkerId}/calendar/generate`, null, {
    params: { from, to },
  })
  return res.data.data.days_generated
}

export async function listCalendar(satkerId: string, from: string, to: string) {
  const res = await http.get<ListCalendarResp>(`/satkers/${satkerId}/calendar`, {
    params: { from, to },
  })
  return res.data.data
}
