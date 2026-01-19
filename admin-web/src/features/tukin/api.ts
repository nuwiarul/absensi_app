import { http } from "@/lib/http"
import type {
  CreateTukinPolicyReq,
  LeaveRulesResp,
  SaveLeaveRulesReq,
  TukinCalculationsResp,
  TukinPolicy,
  TukinPolicyResp,
  UpdateTukinPolicyReq,
} from "./types"

export async function fetchTukinCalculations(params: {
  month: string
  satker_id?: string
  user_id?: string
}): Promise<TukinCalculationsResp["data"]> {
  const res = await http.get<TukinCalculationsResp>("/tukin/calculations", { params })
  return res.data.data
}

export async function generateTukinCalculations(params: {
  month: string
  satker_id?: string
  user_id?: string
  force?: boolean
}): Promise<TukinCalculationsResp["data"]> {
  const res = await http.post<TukinCalculationsResp>("/tukin/generate", null, { params })
  return res.data.data
}

export async function fetchTukinPolicies(params?: { satker_id?: string }): Promise<TukinPolicy[]> {
  const res = await http.get<TukinPolicyResp>("/tukin/policies", { params })
  return res.data.data
}

export async function createTukinPolicy(payload: CreateTukinPolicyReq): Promise<TukinPolicy> {
  const res = await http.post<{ status: string; data: TukinPolicy }>("/tukin/policies", payload)
  return res.data.data
}

export async function updateTukinPolicy(id: string, payload: UpdateTukinPolicyReq): Promise<void> {
  await http.put(`/tukin/policies/${id}`, payload)
}

export async function fetchLeaveRules(policyId: string): Promise<LeaveRulesResp["data"]> {
  const res = await http.get<LeaveRulesResp>(`/tukin/policies/${policyId}/leave-rules`)
  return res.data.data
}

export async function saveLeaveRules(policyId: string, payload: SaveLeaveRulesReq): Promise<void> {
  await http.put(`/tukin/policies/${policyId}/leave-rules`, payload)
}
