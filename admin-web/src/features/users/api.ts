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
