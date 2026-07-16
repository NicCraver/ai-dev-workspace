/**
 * 契约：个人AI框域 · 知识范围记忆
 * POST /agentSetDataRangeExpand/saveDataRange
 * Changelog:
 * - 2026-07-14 新增 POST /agentSetDataRangeExpand/saveDataRange
 * - 2026-07-16 对齐 YApi：dataRangeType 明确 0–4（含 3-个人 / 4-分享）；
 *   dataRangeScopeList 子项 scopeDataType / scopeDataId 必填；字段注释补全
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
  /**
   * 智能体数据范围
   * 单项 dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人；4-分享
   * 单项 choose：0-未选中；1-选中
   */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** 时间类型（一定有值） */
  timeType?: number;
  /** 联网搜索：0-未开启；1-开启 */
  netSearch?: number;
  /** 深度思考：0-未开启；1-开启 */
  deepThink?: number;
  /**
   * 数据范围（人和群）
   * 子项必填：scopeDataType（1-私聊；3-群聊）、scopeDataId（私聊=人员 id；群聊=群组 id）
   */
  dataRangeScopeList?: PersonalAiFrameDataRangeScope[];
}

/** POST /agentSetDataRangeExpand/saveDataRange 业务 data（成功时无业务字段） */
export interface PersonalAiFrameSaveDataRangeData {}

/** POST /agentSetDataRangeExpand/saveDataRange 完整回参 */
export type PersonalAiFrameSaveDataRangeResp =
  ApiResponse<PersonalAiFrameSaveDataRangeData>;
