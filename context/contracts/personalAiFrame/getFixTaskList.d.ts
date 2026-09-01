/**
 * 契约：个人AI框域 · 获取定时任务列表
 * POST /agentSetBasic/getFixTaskList
 * Changelog:
 * - 2026-09-01 新增本文件。对齐后端 2026-08-31：dataRangeType 增加 5-周工作；
 *   回参 fixedTimeTaskList.dealMeans.aiParaInfo 增加 weekWorkScopeList、8 个
 *   weekWorkSelectAll*、showRangeTxt（与 saveAgentSetInfo 的 AiParaInfo 共用）。
 *   入参字段表本次文档未给完整表，标 @unconfirmed。
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAgentSetFixedTimeTask } from './saveAgentSetInfo';

/** POST /agentSetBasic/getFixTaskList 入参 */
export interface PersonalAiFrameGetFixTaskListReq {
  /** @unconfirmed */
  accountId?: string;
  /** @unconfirmed */
  agentId?: string;
  /** @unconfirmed */
  agentVersionId?: string;
}

/** POST /agentSetBasic/getFixTaskList 业务 data */
export interface PersonalAiFrameGetFixTaskListData {
  /**
   * 定时任务列表。周工作字段在
   * fixedTimeTaskList[].dealMeans[].aiParaInfo
   */
  fixedTimeTaskList?: PersonalAiFrameAgentSetFixedTimeTask[];
}

/** POST /agentSetBasic/getFixTaskList 完整回参 */
export type PersonalAiFrameGetFixTaskListResp =
  ApiResponse<PersonalAiFrameGetFixTaskListData>;
