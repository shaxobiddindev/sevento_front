import { useMutation } from '@tanstack/react-query'

import { realtimeApi } from '@/shared/realtime'

export function useSendNotice() {
  return useMutation({ mutationFn: realtimeApi.notice })
}
