import apiClient from "./client";
import { ApiResponse, ProjectMember, ProjectInvite, ProjectRole } from "../types";

export const teamApi = {
  // Members
  getMembers: (projectId: string) =>
    apiClient.get<ApiResponse<ProjectMember[]>>(`/projects/${projectId}/members`),

  inviteMember: (projectId: string, data: { email: string; role: ProjectRole }) =>
    apiClient.post<ApiResponse<ProjectInvite>>(`/projects/${projectId}/members/invite`, data),

  updateRole: (projectId: string, memberId: string, role: ProjectRole) =>
    apiClient.patch<ApiResponse<ProjectMember>>(`/projects/${projectId}/members/${memberId}/role`, { role }),

  removeMember: (projectId: string, memberId: string) =>
    apiClient.delete<ApiResponse<{ memberId: string }>>(`/projects/${projectId}/members/${memberId}`),

  leaveProject: (projectId: string) =>
    apiClient.delete<ApiResponse<null>>(`/projects/${projectId}/members/leave`),

  getProjectInvites: (projectId: string) =>
    apiClient.get<ApiResponse<ProjectInvite[]>>(`/projects/${projectId}/invites`),

  // My invites
  getMyInvites: () =>
    apiClient.get<ApiResponse<ProjectInvite[]>>(`/projects/invites/pending`),

  acceptInvite: (token: string) =>
    apiClient.post<ApiResponse<{ member: ProjectMember; project: { id: string; name: string } }>>(`/projects/invites/${token}/accept`),

  declineInvite: (token: string) =>
    apiClient.post<ApiResponse<null>>(`/projects/invites/${token}/decline`),
};
