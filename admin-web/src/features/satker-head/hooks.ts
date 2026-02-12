import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
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
  return useToastMutation({
    mutationFn: ({ satkerId, userId }: { satkerId: string; userId: string }) =>
      setSatkerHead(satkerId, { user_id: userId }),
    successMessage: "Satker head berhasil di-set",
    invalidateQueries: [
      ["satker-heads"],
      ["users"],
    ],
    onError: (e) => {
      toast.error(apiErrorMessage(e, { title: "Gagal set satker head" }))
    },
  })
}
