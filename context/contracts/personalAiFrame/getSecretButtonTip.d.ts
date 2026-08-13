/**
 * 契约：个人AI框域 · 获取涉密按钮提示文案
 * POST /personalAiFrame/getSecretButtonTip
 * 分类：智信AI框-基础服务
 * Changelog:
 * - 2026-08-13 新增 POST /personalAiFrame/getSecretButtonTip（无入参；回参 data 为配置文案字符串）
 *   后端状态「开发中」；文案取自 application.properties 的 personal.ai.frame.secret.tip.text
 */

import type { ApiResponse } from '../_common';

/**
 * POST /personalAiFrame/getSecretButtonTip 入参
 * 无字段。调用方 POST 空 body（`{}` 或不传 body 均可）。
 */
export type PersonalAiFrameGetSecretButtonTipReq = Record<string, never>;

/**
 * POST /personalAiFrame/getSecretButtonTip 业务 data
 * 直接是文案字符串（不是对象），供「选择数据范围」标题栏涉密按钮气泡展示
 * mock: '涉密信息请勿外传'
 */
export type PersonalAiFrameGetSecretButtonTipData = string;

/** POST /personalAiFrame/getSecretButtonTip 完整回参 */
export type PersonalAiFrameGetSecretButtonTipResp =
  ApiResponse<PersonalAiFrameGetSecretButtonTipData>;
