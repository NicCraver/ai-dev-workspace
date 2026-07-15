/**
 * 契约：个人AI框域 · 新增/编辑常用语
 * POST /quickReply/save
 * Changelog:
 * - 2026-07-14 新增 POST /quickReply/save
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameQuickReplyType } from './quickReplyList';

/** POST /quickReply/save 入参 */
export interface PersonalAiFrameQuickReplySaveReq {
  /** 编辑时必填，新增时留空 */
  id?: string;
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 当前 AI 框智能体 id */
  agentId: string;
  /** 1-个人（本人可操作）；2-群（群 AI 框管理员可操作） */
  type: PersonalAiFrameQuickReplyType;
  /** 常用语内容 */
  content: string;
}

/** POST /quickReply/save 业务 data（成功时无业务字段） */
export interface PersonalAiFrameQuickReplySaveData {}

/** POST /quickReply/save 完整回参 */
export type PersonalAiFrameQuickReplySaveResp =
  ApiResponse<PersonalAiFrameQuickReplySaveData>;
