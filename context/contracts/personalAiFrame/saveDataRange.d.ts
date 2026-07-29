/**
 * 契约：个人AI框域 · 知识范围记忆
 * POST /agentSetDataRangeExpand/saveDataRange
 * Changelog:
 * - 2026-07-29 对齐 YApi（2026-07-28 更新）：新增 groupAndAccountSelectAll /
 *   organizationGroupSelectAll / outreachGroupSelectAll 三个全选标记（0/1，非必填）。
 *   语义：表达「用户勾了全选」的意图，后端据此在新增群时自动把新群补进 dataRangeScopeList。
 *   前端仍需照传全量 dataRangeScopeList 明细，不得用空列表覆盖。
 * - 2026-07-14 新增 POST /agentSetDataRangeExpand/saveDataRange
 * - 2026-07-16 对齐 YApi：dataRangeType 明确 0–4（含 3-个人 / 4-分享）；
 *   dataRangeScopeList 子项 scopeDataType / scopeDataId 必填；字段注释补全
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameDataRangeScope,
} from './_shared';

/** 全选标记：1-勾选了全部；0-未勾选全部 */
export type PersonalAiFrameSelectAllFlag = 0 | 1;

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
  /**
   * 人员和群勾选全部：1-勾选了全部；0-未勾选全部
   * 前端按弹窗勾选推断；getAgentDataRange 回参在 @unconfirmed 字段落地后也会回传此值用于 restore
   */
  groupAndAccountSelectAll?: PersonalAiFrameSelectAllFlag;
  /**
   * 组织群勾选全部：1-勾选了全部；0-未勾选全部（组织群 = groupInfo.type 缺省或 < 10）
   * 前端按弹窗勾选推断；getAgentDataRange 回参在 @unconfirmed 字段落地后也会回传此值用于 restore
   */
  organizationGroupSelectAll?: PersonalAiFrameSelectAllFlag;
  /**
   * 外联群勾选全部：1-勾选了全部；0-未勾选全部（外联群 = groupInfo.type >= 10）
   * 前端按弹窗勾选推断；getAgentDataRange 回参在 @unconfirmed 字段落地后也会回传此值用于 restore
   */
  outreachGroupSelectAll?: PersonalAiFrameSelectAllFlag;
}

/** POST /agentSetDataRangeExpand/saveDataRange 业务 data（成功时无业务字段） */
export interface PersonalAiFrameSaveDataRangeData {}

/** POST /agentSetDataRangeExpand/saveDataRange 完整回参 */
export type PersonalAiFrameSaveDataRangeResp =
  ApiResponse<PersonalAiFrameSaveDataRangeData>;
