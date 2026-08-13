/**
 * 契约：个人AI框域 · 获取 Agent 设置信息（不含知识库）
 * POST /agentSetBasic/getAgentSetInfo
 * Changelog:
 * - 2026-08-12 回参 data 增加 hideChat（1-隐藏聊天记录/聊天文件相关配置）
 * - 2026-08-12 新增 POST /agentSetBasic/getAgentSetInfo
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameSaveAgentSetInfoData } from './saveAgentSetInfo';

/** POST /agentSetBasic/getAgentSetInfo 入参 */
export interface PersonalAiFrameGetAgentSetInfoReq {
  /** 智能体所属企业 id */
  corpId: string;
  /** 智能体 id */
  agentId: string;
  /** 账号 id */
  accountId: string;
}

/**
 * POST /agentSetBasic/getAgentSetInfo 业务 data
 * 在 saveAgentSetInfo 回参基础上增加 hideChat（仅 get 回参）
 */
export interface PersonalAiFrameGetAgentSetInfoData
  extends PersonalAiFrameSaveAgentSetInfoData {
  /** 1-隐藏聊天记录、聊天文件相关配置；mock: 0 */
  hideChat?: number;
}

/** POST /agentSetBasic/getAgentSetInfo 完整回参 */
export type PersonalAiFrameGetAgentSetInfoResp =
  ApiResponse<PersonalAiFrameGetAgentSetInfoData>;
