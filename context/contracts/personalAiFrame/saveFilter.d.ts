/**
 * 契约：个人AI框域 · 保存筛选记忆
 * POST /personalAiFrame/saveFilter
 * YApi: http://192.168.5.46:3100/project/255/interface/api/14166
 * Changelog:
 * - 2026-07-16 新增 POST /personalAiFrame/saveFilter（覆盖式保存筛选类型多选；空数组=清空筛选）
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameFilterType } from './_shared';

/** POST /personalAiFrame/saveFilter 入参 */
export interface PersonalAiFrameSaveFilterReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /**
   * 筛选类型（多选，覆盖式）
   * - 不传：不修改记忆（@unconfirmed，YApi 未列；web 改筛时始终显式传数组）
   * - `[]`：清空筛选
   * - `[1]`：仅近15天问答
   * - `[2]`：仅有知识库
   * - `[1,2]`：同时勾选
   */
  filterTypes?: PersonalAiFrameFilterType[];
}

/** POST /personalAiFrame/saveFilter 业务 data（成功时无业务字段） */
export interface PersonalAiFrameSaveFilterData {}

/** POST /personalAiFrame/saveFilter 完整回参 */
export type PersonalAiFrameSaveFilterResp =
  ApiResponse<PersonalAiFrameSaveFilterData>;
