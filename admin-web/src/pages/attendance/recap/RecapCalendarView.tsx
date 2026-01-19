import * as React from "react"

export type CalendarCell = {
  ymd: string
  day: number
  inMonth: boolean
  disabled: boolean
  kind: string
  label?: string
  is_manual?: boolean
}

export type CalendarModel = {
  cells: CalendarCell[]
}

export type RecapCalendarViewProps = {
  calendar: CalendarModel
  calendarCellClass: (kind: string) => string
  onPickDay: (ymd: string) => void
}

export function RecapCalendarView(props: RecapCalendarViewProps) {
  const { calendar, calendarCellClass, onPickDay } = props

  return (
    <div className="rounded-md border p-3">
      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
          <div key={d} className="text-center font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {calendar.cells.map((c, idx) => {
          const isDisabled = !c.inMonth || c.disabled || c.day <= 0
          return (
            <button
              key={`${c.ymd}-${idx}`}
              type="button"
              disabled={isDisabled}
              onClick={() => onPickDay(c.ymd)}
              className={
                `relative flex h-20 flex-col rounded-md p-2 text-left transition ` +
                (isDisabled
                  ? "opacity-40 cursor-not-allowed bg-muted/20"
                  : `${calendarCellClass(c.kind)} hover:ring-2 hover:ring-primary/30`)
              }
            >
              <div className="text-sm font-semibold">{c.inMonth && c.day > 0 ? c.day : ""}</div>
              {c.is_manual ? (
                <div className="absolute right-1 top-1 rounded bg-background/70 px-1 text-[10px] font-semibold">
                  M
                </div>
              ) : null}
              {c.label ? (
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.label}</div>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">Klik tanggal untuk melihat detail.</div>
    </div>
  )
}
