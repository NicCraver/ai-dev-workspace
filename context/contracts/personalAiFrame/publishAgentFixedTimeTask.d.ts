/**
 * 契约：个人AI框域 · 发布定时任务
 * POST /agentSetBasic/publishAgentFixedTimeTask
 * Changelog:
 * - 2026-09-01 新增本文件。对齐后端 2026-08-31：入参
 *   fixedTimeTaskList[].dealMeans[].aiParaInfo 增加周工作记忆（含 showRangeTxt）；
 *   dataRangeType 含 5-周工作。
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAgentSetFixedTimeTask } from './saveAgentSetInfo';

/** POST /agentSetBasic/publishAgentFixedTimeTask 入参 */
export interface PersonalAiFramePublishAgentFixedTimeTaskReq {
  /** @unconfirmed 与 saveAgentSetInfo 对称的公共字段 */
  accountId?: string;
  agentId?: string;
  agentVersionId?: string;
  /** 周工作字段在 dealMeans.aiParaInfo */
  fixedTimeTaskList?: PersonalAiFrameAgentSetFixedTimeTask[];
}

/** POST /agentSetBasic/publishAgentFixedTimeTask 业务 data */
export interface PersonalAiFramePublishAgentFixedTimeTaskData {}

/** POST /agentSetBasic/publishAgentFixedTimeTask 完整回参 */
export type PersonalAiFramePublishAgentFixedTimeTaskResp =
  ApiResponse<PersonalAiFramePublishAgentFixedTimeTaskData>;
