export type AppTimezone = "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura"

export type TimezoneData = {
  timezone: AppTimezone
  current_year: number
}

export type TimezoneResp = {
  status: string
  data: TimezoneData
}

export type UpdateTimezoneReq = {
  timezone: AppTimezone
}
