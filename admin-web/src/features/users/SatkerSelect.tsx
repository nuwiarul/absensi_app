import * as React from "react"
import type { Satker } from "@/features/satkers/types"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type Props = {
    value?: string
    onChange: (v: string) => void
    items: Satker[]
    placeholder?: string
    disabled?: boolean

    /**
     * Jika true, tambahkan opsi "Semua" (mis. untuk filter).
     * Gunakan allValue yang bukan string kosong (Radix Select tidak menerima "").
     */
    allowAll?: boolean
    allLabel?: string
    allValue?: string
}

export function SatkerSelect({
                                 value,
                                 onChange,
                                 items,
                                 placeholder,
                                 disabled,

                                 allowAll,
                                 allLabel,
                                 allValue,
                             }: Props) {
    const labelOf = React.useCallback(
        (id?: string) => {
            const s = items.find((x) => x.id === id)
            return s ? `${s.code} - ${s.name}` : ""
        },
        [items]
    )

    const effectiveAllValue = allValue ?? "ALL"

    return (
        // Radix Select tidak menerima value string kosong ("").
        <Select value={value && value.length > 0 ? value : undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
                <SelectValue placeholder={placeholder ?? "Pilih satker"}>
                    {value && value !== effectiveAllValue ? labelOf(value) : null}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {allowAll && (
                    <SelectItem value={effectiveAllValue}>{allLabel ?? "Semua"}</SelectItem>
                )}
                {items.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                        {s.code} - {s.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
