import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiErrorMessage } from "@/lib/api-error"
import { listSatkerHeads, setSatkerHead } from "./api"

export function useSatkerHeads() {
  return useQuery({
    queryKey: ["satker-heads"],
    queryFn: listSatkerHeads,
  })
}

export function useSetSatkerHead() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ satkerId, userId }: { satkerId: string; userId: string }) =>
      setSatkerHead(satkerId, { user_id: userId }),
    onSuccess: () => {
      toast.success("Satker head berhasil di-set")
      qc.invalidateQueries({ queryKey: ["satker-heads"] })
      qc.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (e) => {
      toast.error(apiErrorMessage(e, { title: "Gagal set satker head" }))
    },
  })
}
