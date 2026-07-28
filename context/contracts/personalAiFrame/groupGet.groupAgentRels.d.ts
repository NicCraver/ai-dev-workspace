/**
 * 契约：群详情 · 智能体关联（本功能消费片段）
 * POST /api/chat/v1/group/get（分类：群组相关）
 * Changelog:
 * - 2026-07-27 实测确认：groupAgentRels[].accountId 已返回；groupAgentType：
 *   群智能体(groupAgentRel)=3，个人(groupAgentRels)=0；个人项 imToken 可为 null
 * - 2026-07-27 对齐接口文档：区分 groupAgentRel（群智能体）与 groupAgentRels（群内个人智能体）；
 *   补请求体；groupAgentRels 项补 accountId
 * - 2026-07-27 初稿（仅 groupAgentRels）
 */

import type { ApiResponse } from '../_common';

/** POST /group/get 入参 */
export interface GroupGetReq {
  /** 群 id；必填 */
  id: string;
  /** 当前账号 id；可选 */
  accountId?: string;
  /** 类型；可选 */
  type?: number;
  /** 版本；可选 */
  version?: string;
}

/**
 * 智能体关联公共字段
 * - `@` 弹窗 / 会话消息发送人：按 agentAccountId 返显头像、名称（agentName / agentAvatar）
 */
export interface GroupAgentRelInfo {
  id?: string;
  agentId?: string;
  groupId?: string;
  /** 名称（现网个人项可能与群智能体同名，需靠 accountId / agentAccountId 区分） */
  agentName?: string;
  /** 头像 */
  agentAvatar?: string;
  /** 智能体融云账号 id（ga_ 前缀） */
  agentAccountId?: string;
  /** 群智能体有值；个人项现网可为 null */
  imToken?: string | null;
  isDel?: number;
  creator?: string;
  createAt?: string;
  updator?: string;
  updateAt?: string;
  /**
   * 智能体类型（现网实测）
   * - 3：群智能体（出现在 groupAgentRel）
   * - 0：群内个人智能体（出现在 groupAgentRels）
   */
  groupAgentType?: number;
  /**
   * 归属人账号 id（真人）
   * - 个人智能体：有值，用于 `accountId === 当前登录人` 过滤「只 @ 自己」
   * - 群智能体：现网为 null
   */
  accountId?: string | null;
}

/**
 * 群内个人智能体（data.groupAgentRels[]）
 * - `@` 候选人：仅 `accountId === 当前登录人` 的那条
 * - 会话消息发送人回显：用该条的 agentAccountId → agentName / agentAvatar
 * - 同群可有多条（多人各自个人 AI），名称可能相同
 */
export type GroupPersonalAgentRel = GroupAgentRelInfo;

/**
 * group/get 回参中与本功能相关的片段（非完整群详情）
 *
 * | 字段 | 说明 | 本功能用途 |
 * |------|------|------------|
 * | groupAgentRel | 群智能体（单条；groupAgentType=3） | `@` 群智能体、消息返显 |
 * | groupAgentRels | 群内个人智能体列表（groupAgentType=0 + accountId） | `@` 自己的个人 AI、消息返显 |
 */
export interface GroupGetAgentSlice {
  /** 群智能体（单条，可空） */
  groupAgentRel?: GroupAgentRelInfo | null;
  /** 群内个人智能体列表 */
  groupAgentRels?: GroupPersonalAgentRel[];
}

/** POST /group/get — 本功能只消费智能体相关字段 */
export type GroupGetAgentRes = ApiResponse<GroupGetAgentSlice>;
