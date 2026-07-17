/**
 * 契约：个人AI框域 · 获取整体角标及最新缩略信息
 * POST /agentSetBasic/getBadgePushInfo
 * YApi: http://192.168.5.46:3100/project/255/interface/api/14196
 * Changelog:
 * - 2026-07-17 新增 POST /agentSetBasic/getBadgePushInfo（整体黄色角标数 + 最新缩略信息）
 */

import type { ApiResponse } from '../_common';

/** POST /agentSetBasic/getBadgePushInfo 入参 */
export interface PersonalAiFrameGetBadgePushInfoReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
}

/**
 * POST /agentSetBasic/getBadgePushInfo 业务 data
 * 供推送后三端拉真实角标/副标题用（勿直接用融云 payload 数字写角标）
 */
export interface PersonalAiFrameGetBadgePushInfoData {
  /** 黄色角标数；mock: 0 */
  yellowUnreadNumber?: number;
  /**
   * 最新缩略信息（会话列表「AI框」入口副标题等）
   * 可能为 null；mock: null
   */
  lastAbbreviationInfo?: string | null;
}

/** POST /agentSetBasic/getBadgePushInfo 完整回参 */
export type PersonalAiFrameGetBadgePushInfoResp =
  ApiResponse<PersonalAiFrameGetBadgePushInfoData>;
