import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MutationFunction, QueryKey, UseMutationOptions } from "@tanstack/react-query"

type ToastSuccessMessage<TData, TVariables> =
  | string
  | ((data: TData, variables: TVariables) => string | undefined)

type InvalidateQueriesSource<TVariables> =
  | QueryKey[]
  | ((variables: TVariables) => QueryKey[] | undefined)

export interface UseToastMutationOptions<
  TData,
  TError,
  TVariables,
  TContext,
> extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> {
  mutationFn: MutationFunction<TData, TVariables>
  successMessage?: ToastSuccessMessage<TData, TVariables>
  invalidateQueries?: InvalidateQueriesSource<TVariables>
}

export function useToastMutation<
  TData,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(options: UseToastMutationOptions<TData, TError, TVariables, TContext>) {
  const qc = useQueryClient()
  const { mutationFn, successMessage, invalidateQueries, onSuccess, ...rest } = options

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    ...rest,
    onSuccess: (data, variables, onMutateResult, context) => {
      const message =
        typeof successMessage === "function" ? successMessage(data, variables) : successMessage
      if (message) {
        toast.success(message)
      }

      const targetQueries =
        typeof invalidateQueries === "function"
          ? invalidateQueries(variables)
          : invalidateQueries

      targetQueries?.forEach((key) => {
        qc.invalidateQueries({ queryKey: key })
      })

      onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}
