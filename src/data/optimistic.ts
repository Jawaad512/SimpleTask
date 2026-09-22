import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'

/**
 * §9.4 — every write is optimistic. The cache moves first, the network catches
 * up. On failure the cache rolls back and a plain-language toast says what
 * didn't save.
 */
export function useOptimisticList<TRow, TVars>(options: {
  keys: QueryKey[]
  mutationFn: (vars: TVars) => Promise<unknown>
  /** Patch applied to the first key's cache before the request goes out. */
  apply: (rows: TRow[], vars: TVars) => TRow[]
  errorMessage: string | ((vars: TVars) => string)
  onSuccess?: (vars: TVars) => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { keys, mutationFn, apply, errorMessage, onSuccess } = options
  const primary = keys[0]

  return useMutation({
    mutationFn,

    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: primary })
      const previous = queryClient.getQueryData<TRow[]>(primary)
      if (previous) queryClient.setQueryData<TRow[]>(primary, apply(previous, vars))
      return { previous }
    },

    onError: (_error, vars, context) => {
      if (context?.previous) queryClient.setQueryData<TRow[]>(primary, context.previous)
      toast.showError(typeof errorMessage === 'function' ? errorMessage(vars) : errorMessage)
    },

    onSuccess: (_data, vars) => onSuccess?.(vars),

    onSettled: () => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
