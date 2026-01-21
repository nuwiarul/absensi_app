import { http } from "@/lib/http"
import type {
  ApiResponse,
  User,
  CreateUserReq,
  UpdateUserReq,
} from "./types"

export async function getUsers(): Promise<User[]> {
  const res = await http.get<ApiResponse<User[]>>("/users")
  return res.data.data
}

export async function getUsersBySatker(satkerId: string): Promise<User[]> {
  const res = await http.get<ApiResponse<User[]>>(`/users/satkers/${satkerId}`)
  return res.data.data ?? []
}

export async function createUser(payload: CreateUserReq): Promise<string> {
  const res = await http.post<ApiResponse<string>>("/users/create", payload)
  return res.data.data
}

export async function updateUser(
    id: string,
    payload: UpdateUserReq
): Promise<string> {
  const res = await http.put<ApiResponse<string>>(
      `/users/update/${id}`,
      payload
  )
  return res.data.data
}

export async function deleteUser(id: string): Promise<string> {
  const res = await http.delete<ApiResponse<string>>(`/users/delete/${id}`)
  return res.data.data
}


export async function getMe(): Promise<User> {
  const res = await http.get<ApiResponse<User>>("/users/me")
  return res.data.data
}

export async function updateMyProfile(payload: { full_name: string; phone?: string | null }): Promise<string> {
  const res = await http.put<ApiResponse<string>>("/users/me/profile", payload)
  return res.data.data
}

export async function changeMyPassword(payload: { old_password: string; password: string; password_confirm: string }): Promise<string> {
  const res = await http.post<ApiResponse<string>>("/users/me/password", payload)
  return res.data.data
}

export async function uploadMyPhoto(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await http.post<ApiResponse<string>>("/users/me/photo", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data.data
}

export async function adminSetPassword(id: string, payload: { password: string; password_confirm: string }): Promise<string> {
  const res = await http.post<ApiResponse<string>>(`/users/${id}/password`, payload)
  return res.data.data
}

export async function adminUploadPhoto(id: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await http.post<ApiResponse<string>>(`/users/${id}/photo`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data.data
}


/*
import { http } from "@/lib/http"
import type {
  ApiResponse,
  User,
  CreateUserReq,
  UpdateUserReq,
} from "./types"

export async function getUsers(): Promise<User[]> {
  const res = await http.get<ApiResponse<User[]>>("/users")
  return res.data.data
}

export async function getUsersBySatker(satkerId: string): Promise<User[]> {
  const res = await http.get<ApiResponse<User[]>>(`/users/satkers/${satkerId}`)
  return res.data.data ?? []
}

export async function createUser(payload: CreateUserReq): Promise<string> {
  const res = await http.post<ApiResponse<string>>("/users/create", payload)
  return res.data.data
}

export async function updateUser(
  id: string,
  payload: UpdateUserReq
): Promise<string> {
  const res = await http.put<ApiResponse<string>>(
    `/users/update/${id}`,
    payload
  )
  return res.data.data
}

export async function deleteUser(id: string): Promise<string> {
  const res = await http.delete<ApiResponse<string>>(`/users/delete/${id}`)
  return res.data.data
}
*/
