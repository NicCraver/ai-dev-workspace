/**
 * 契约：个人AI框域 · 更新 AI 框设置（隐藏、置顶）
 * POST /personalAiFrame/updateSetting
 * Changelog:
 * - 2026-07-14 新增 POST /personalAiFrame/updateSetting
 */

import type { ApiResponse } from '../_common';

/** 0-否；1-是 */
export type PersonalAiFrameSettingFlag = 0 | 1;

/** POST /personalAiFrame/updateSetting 入参 */
export interface PersonalAiFrameUpdateSettingReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 智能体 id */
  agentId: string;
  /** 是否置顶：0-否；1-是（不传不修改） */
  isPinned?: PersonalAiFrameSettingFlag;
  /** 是否隐藏：0-否；1-是（不传不修改） */
  isHidden?: PersonalAiFrameSettingFlag;
}

/** POST /personalAiFrame/updateSetting 业务 data（成功时无业务字段） */
export interface PersonalAiFrameUpdateSettingData {}

/** POST /personalAiFrame/updateSetting 完整回参 */
export type PersonalAiFrameUpdateSettingResp =
  ApiResponse<PersonalAiFrameUpdateSettingData>;
