/**
 * 契约：个人AI框域 · 保存全部定时任务
 * POST /agentSetBasic/saveAllAgentFixedTimeTask
 * Changelog:
 * - 2026-09-01 新增本文件。对齐后端 2026-08-31：入参
 *   fixedTimeTaskList[].dealMeans[].aiParaInfo 增加周工作记忆（含 showRangeTxt）；
 *   dataRangeType 含 5-周工作。
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAgentSetFixedTimeTask } from './saveAgentSetInfo';

/** POST /agentSetBasic/saveAllAgentFixedTimeTask 入参 */
export interface PersonalAiFrameSaveAllAgentFixedTimeTaskReq {
  /** @unconfirmed 与 saveAgentSetInfo 对称的公共字段 */
  accountId?: string;
  agentId?: string;
  agentVersionId?: string;
  /** 周工作字段在 dealMeans.aiParaInfo */
  fixedTimeTaskList?: PersonalAiFrameAgentSetFixedTimeTask[];
}

/** POST /agentSetBasic/saveAllAgentFixedTimeTask 业务 data */
export interface PersonalAiFrameSaveAllAgentFixedTimeTaskData {}

/** POST /agentSetBasic/saveAllAgentFixedTimeTask 完整回参 */
export type PersonalAiFrameSaveAllAgentFixedTimeTaskResp =
  ApiResponse<PersonalAiFrameSaveAllAgentFixedTimeTaskData>;
