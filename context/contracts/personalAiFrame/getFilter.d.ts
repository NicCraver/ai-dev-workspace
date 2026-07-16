/**
 * 契约：个人AI框域 · 查询筛选记忆
 * POST /personalAiFrame/getFilter
 * YApi: http://192.168.5.46:3100/project/255/interface/api/14169
 * Changelog:
 * - 2026-07-14 新增 POST /personalAiFrame/getFilter（返回用户上次保存的筛选条件；无记录时 filterTypes 为空数组）
 * - 2026-07-14 对齐 YApi #14169：回参 personalChecked + filterTypes 确认；入参仅 accountId
 *   （YApi Body 表误列 filterTypes「覆盖式/空数组清空」——属 saveFilter / list 写入语义，本接口为初始化只读拉取，不采纳）
 * - 2026-07-16 筛选写入专用接口见 saveFilter.d.ts
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameFilterInfo } from './_shared';

/** POST /personalAiFrame/getFilter 入参 */
export interface PersonalAiFrameGetFilterReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
}

/**
 * POST /personalAiFrame/getFilter 业务 data
 * 字段与 list 回参 `filterInfo` 一致（PersonalAiFrameFilterInfo）
 * - personalChecked：个人AI框是否勾选（始终 true）
 * - filterTypes：上次保存的筛选类型（多选）；无记录时为空数组
 */
export type PersonalAiFrameGetFilterData = PersonalAiFrameFilterInfo;

/** POST /personalAiFrame/getFilter 完整回参 */
export type PersonalAiFrameGetFilterResp =
  ApiResponse<PersonalAiFrameGetFilterData>;
