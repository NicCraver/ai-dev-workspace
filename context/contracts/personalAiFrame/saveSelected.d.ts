/**
 * 契约：个人AI框域 · 保存选中的 AI 框
 * POST /personalAiFrame/saveSelected
 * Changelog:
 * - 2026-07-14 新增 POST /personalAiFrame/saveSelected（保存选中的 AI 框）
 */

import type { ApiResponse } from '../_common';

/** 选中项归属类型：1-私聊；3-群聊 */
export type PersonalAiFrameSaveSelectedBelongType = 1 | 3;

/** POST /personalAiFrame/saveSelected 入参 · selectedList 单项 */
export interface PersonalAiFrameSaveSelectedItem {
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** 归属类型：1-私聊；3-群聊；mock: 3 */
  belongType?: PersonalAiFrameSaveSelectedBelongType;
  /** 归属 id（私聊=对方 accountId，群聊=groupId）；mock: '@string("lower", 18)' */
  belongId?: string;
}

/** POST /personalAiFrame/saveSelected 入参 */
export interface PersonalAiFrameSaveSelectedReq {
  /** 当前登录账号 id；mock: 'u10086' */
  accountId: string;
  /** 选中的 AI 框列表 */
  selectedList?: PersonalAiFrameSaveSelectedItem[];
}

/** POST /personalAiFrame/saveSelected 业务 data（成功时无业务字段） */
export interface PersonalAiFrameSaveSelectedData {}

/** POST /personalAiFrame/saveSelected 完整回参 */
export type PersonalAiFrameSaveSelectedResp =
  ApiResponse<PersonalAiFrameSaveSelectedData>;
