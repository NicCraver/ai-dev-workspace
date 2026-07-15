/**
 * 契约：个人AI框域 · 批量查询 AI 框智能体详情（公共接口）
 * POST /personalAiFrame/batchGetAgent
 * YApi: http://192.168.5.46:3100/project/255/interface/api/14187
 * Changelog:
 * - 2026-07-14 新增（按 groupIds+accountIds 批量返回；不限创建人；无数据则不出现在对应 Map）
 */

import type { ApiResponse } from '../_common';

/** POST /personalAiFrame/batchGetAgent 入参 */
export interface PersonalAiFrameBatchGetAgentReq {
  /** 登录人 accountId；mock: '280' */
  accountId: string;
  /** 群组 ids；mock: ['1826436977474408450'] */
  groupIds?: string[];
  /** 账号 ids；mock: ['1563064479573393409'] */
  accountIds?: string[];
}

/** AI 框智能体详情（groupMap / accountMap 的 value） */
export interface PersonalAiFrameBatchAgentDetail {
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI 框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** 智能体名称；mock: '@cname()智能体' */
  agentName?: string;
  /** 智能体头像；mock: 'https://cdn.example.com/avatar/@string("lower", 8).png' */
  agentAvatar?: string;
}

/**
 * POST /personalAiFrame/batchGetAgent 业务 data
 * key 分别为 groupId / accountId；请求里有但无数据的 id 不会出现在 Map 中
 */
export interface PersonalAiFrameBatchGetAgentData {
  /** key = groupId */
  groupMap?: Record<string, PersonalAiFrameBatchAgentDetail>;
  /** key = accountId */
  accountMap?: Record<string, PersonalAiFrameBatchAgentDetail>;
}

/** POST /personalAiFrame/batchGetAgent 完整回参 */
export type PersonalAiFrameBatchGetAgentResp =
  ApiResponse<PersonalAiFrameBatchGetAgentData>;
