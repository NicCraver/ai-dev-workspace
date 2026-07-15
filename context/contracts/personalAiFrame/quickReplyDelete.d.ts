/**
 * 契约：个人AI框域 · 批量删除常用语
 * POST /quickReply/delete
 * Changelog:
 * - 2026-07-14 新增 POST /quickReply/delete
 */

import type { ApiResponse } from '../_common';

/** POST /quickReply/delete 入参 */
export interface PersonalAiFrameQuickReplyDeleteReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 当前 AI 框智能体 id */
  agentId: string;
  /** 待删除的常用语 id 列表；按权限过滤，无权删除的会被跳过 */
  ids: string[];
}

/** POST /quickReply/delete 业务 data（成功时无业务字段） */
export interface PersonalAiFrameQuickReplyDeleteData {}

/** POST /quickReply/delete 完整回参 */
export type PersonalAiFrameQuickReplyDeleteResp =
  ApiResponse<PersonalAiFrameQuickReplyDeleteData>;
