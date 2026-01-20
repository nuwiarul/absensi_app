export function formatTanggalIndonesia(iso: string) {
    const d = new Date(iso)
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(d)
}
