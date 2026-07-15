/**
 * 契约：个人AI框域 · 知识范围记忆
 * POST /agentSetDataRangeExpand/saveDataRange
 * Changelog:
 * - 2026-07-14 新增 POST /agentSetDataRangeExpand/saveDataRange
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameDataRangeScope,
} from './_shared';

/** POST /agentSetDataRangeExpand/saveDataRange 入参 */
export interface PersonalAiFrameSaveDataRangeReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 智能体 id */
  agentId: string;
  /** 智能体数据范围 */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** 时间类型（一定有值） */
  timeType?: number;
  /** 联网搜索：0-未开启；1-开启 */
  netSearch?: number;
  /** 深度思考：0-未开启；1-开启 */
  deepThink?: number;
  /** 数据范围（私聊/群聊对象列表） */
  dataRangeScopeList?: PersonalAiFrameDataRangeScope[];
}

/** POST /agentSetDataRangeExpand/saveDataRange 业务 data（成功时无业务字段） */
export interface PersonalAiFrameSaveDataRangeData {}

/** POST /agentSetDataRangeExpand/saveDataRange 完整回参 */
export type PersonalAiFrameSaveDataRangeResp =
  ApiResponse<PersonalAiFrameSaveDataRangeData>;
