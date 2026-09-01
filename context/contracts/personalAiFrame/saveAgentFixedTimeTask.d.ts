/**
 * 契约：个人AI框域 · 保存单条定时任务
 * POST /agentSetBasic/saveAgentFixedTimeTask
 * Changelog:
 * - 2026-09-01 新增本文件。对齐后端 2026-08-31：入参
 *   fixedTimeTask.dealMeans.aiParaInfo 增加周工作记忆（含 showRangeTxt）；
 *   dataRangeType 含 5-周工作。其余入参字段沿用 saveAgentSetInfo 的 FixedTimeTask。
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAgentSetFixedTimeTask } from './saveAgentSetInfo';

/** POST /agentSetBasic/saveAgentFixedTimeTask 入参 */
export interface PersonalAiFrameSaveAgentFixedTimeTaskReq {
  /** @unconfirmed 与 saveAgentSetInfo 对称的公共字段 */
  accountId?: string;
  agentId?: string;
  agentVersionId?: string;
  /** 周工作字段在 dealMeans.aiParaInfo */
  fixedTimeTask?: PersonalAiFrameAgentSetFixedTimeTask;
}

/** POST /agentSetBasic/saveAgentFixedTimeTask 业务 data */
export interface PersonalAiFrameSaveAgentFixedTimeTaskData {}

/** POST /agentSetBasic/saveAgentFixedTimeTask 完整回参 */
export type PersonalAiFrameSaveAgentFixedTimeTaskResp =
  ApiResponse<PersonalAiFrameSaveAgentFixedTimeTaskData>;
