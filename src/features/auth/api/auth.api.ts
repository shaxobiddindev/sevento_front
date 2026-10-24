import { api } from '@/shared/api/client'
import type {
  Capability,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  Me,
} from '@/shared/api/types'

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/auth/login/', body),
  logout: () => api.post<void>('/auth/logout/'),
  me: () => api.get<Me>('/auth/me/'),
  changePassword: (body: ChangePasswordRequest) => api.post<void>('/auth/change-password/', body),
  capabilities: () => api.get<Capability[]>('/auth/capabilities/'),
}
