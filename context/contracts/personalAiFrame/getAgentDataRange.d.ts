/**
 * 契约：个人AI框域 · 知识范围获取
 * POST /agentSetDataRangeExpand/getAgentDataRange
 * Changelog:
 * - 2026-09-01 对齐后端 2026-08-31：dataRangeType 增加 5-周工作；回参增加
 *   weekWorkScopeList、8 个 weekWorkSelectAll*、showRangeTxt。
 * - 2026-08-28 回参补 startTime/endTime（timeType=0）；日期可能为 ISO 串，timeType 可能为 `"0"`。
 * - 2026-07-29 @unconfirmed 回参新增三个全选标记 groupAndAccountSelectAll /
 *   organizationGroupSelectAll / outreachGroupSelectAll（0/1，与 saveDataRange 入参对称）。
 *   起因：这三个标记表达「用户勾了全选」的意图，只由「选择数据来源」弹窗产出；而 saveDataRange
 *   是全量 save（改时间/联网/知识类型都会触发）。若 get 不回传，重启或换会话后前端标记回落 0，
 *   用户随手改个联网就会把后端已存的全选意图静默清零。**后端尚未实现，待联调确认**；
 *   未返回时前端不得按 0 上报，应从 saveDataRange 载荷中省略这三个 key。
 * - 2026-07-27 个人 AI 实测：dataRangeList 为 3/4/1/2（无 0）；默认全选；
 *   dataRangeScopeList 可为 null；timeInfoList type 2–20；knowledgeNeedAuthList 可空；
 *   入参个人 AI 场景优先 accountId+agentId
 * - 2026-07-14 新增 POST /agentSetDataRangeExpand/getAgentDataRange
 * - 2026-07-16 dataRangeType 补齐 3-个人 / 4-分享（与 saveDataRange 对齐）
 * - 2026-07-22 消费方扩至移动端「选择数据范围」原生页（ios/android 打开返显 +
 *   web ACK 后刷新本地 conditionMode）；入参优先传 agentId+accountId
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameSelectAllFlag } from './saveDataRange';
import type { PersonalAiFrameWeekWorkFields } from './_shared';

/** POST /agentSetDataRangeExpand/getAgentDataRange 入参 */
export interface PersonalAiFrameGetAgentDataRangeReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /**
   * 智能体 id
   * - 不传 agentId 时，必传 conditionType、belongId、belongType、aiRoleId
   * - 传了 agentId 时，conditionType/belongId/belongType/aiRoleId 可不传
   */
  agentId?: string;
  /** ai 会话归属条件类型：im-聊天消息；zhiYou-智邮（agentId 未传时必传） */
  conditionType?: string;
  /** 归属 id（agentId 未传时必传） */
  belongId?: string;
  /** 归属类型（agentId 未传时必传） */
  belongType?: number;
  /** ai 框角色 id（agentId 未传时必传） */
  aiRoleId?: string;
}

/** 知识范围单项（含展示信息） */
export interface PersonalAiFrameAgentDataRangeItem {
  /** 范围名称 */
  rangeName?: string;
  /** 范围图标 OSS 链接 */
  iconUrl?: string;
  /** 范围图标背景色，如 #E2ECFF */
  iconBgColor?: string;
  /**
   * 智能体数据范围标记
   * 0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人；4-分享（现网文案「群聊、私聊知识」）；5-周工作
   * 个人 AI 实测回参常见 1/2/3/4，可能不含 0
   */
  dataRangeType?: number;
  /** 0-未选中；1-选中 */
  choose?: number;
}

/** 可选时间类型 */
export interface PersonalAiFrameTimeInfoItem {
  /** 标记 */
  type?: number;
  /** 名称 */
  name?: string;
  /** 时间区间 */
  range?: string;
}

/** 知识库授权项 */
export interface PersonalAiFrameKnowledgeNeedAuthItem {
  /** 第三方服务名称，如 feiShu、wps */
  name?: string;
  /** 授权链接 */
  authUrl?: string;
}

/** @unconfirmed 回参 scopeDataType 文档为 string，saveDataRange 入参为 integer */
export interface PersonalAiFrameAgentDataRangeScopeItem {
  /** 1-私聊；3-群聊 */
  scopeDataType?: string | number;
  /** 私聊=人员 id；群聊=群组 id */
  scopeDataId?: string;
}

/** POST /agentSetDataRangeExpand/getAgentDataRange 业务 data */
export interface PersonalAiFrameGetAgentDataRangeData
  extends PersonalAiFrameWeekWorkFields {
  /** 智能体 id */
  agentId?: string;
  /** 智能体知识范围 */
  dataRangeList?: PersonalAiFrameAgentDataRangeItem[];
  /** 选择的时间类型。0=自定义；接口可能回字符串 "0" */
  timeType?: number | string;
  /** timeType=0 时的区间起，毫秒或 ISO 字符串 */
  startTime?: number | string | null;
  /** timeType=0 时的区间止，毫秒或 ISO 字符串 */
  endTime?: number | string | null;
  /** 选择的时间名称 */
  timeName?: string;
  /** 可选时间类型集合 */
  timeInfoList?: PersonalAiFrameTimeInfoItem[];
  /** 联网搜索：0-未开启；1-开启 */
  netSearch?: number;
  /** 深度思考：0-未开启；1-开启 */
  deepThink?: number;
  /** 选择知识库时需要进行授权的集合 */
  knowledgeNeedAuthList?: PersonalAiFrameKnowledgeNeedAuthItem[];
  /** 数据范围（私聊/群聊对象）；个人 AI 实测可为 null，前端当 [] */
  dataRangeScopeList?: PersonalAiFrameAgentDataRangeScopeItem[] | null;
  /**
   * @unconfirmed 人员和群勾选全部：1-勾选了全部；0-未勾选全部
   * 与 saveDataRange 入参同名字段对称，供前端 restore 全选意图。
   * 后端未实现时为 undefined —— 此时前端不得按 0 上报，应从 save 载荷省略这三个 key
   */
  groupAndAccountSelectAll?: PersonalAiFrameSelectAllFlag;
  /** @unconfirmed 组织群勾选全部：1-勾选了全部；0-未勾选全部（组织群 = groupInfo.type 缺省或 < 10） */
  organizationGroupSelectAll?: PersonalAiFrameSelectAllFlag;
  /** @unconfirmed 外联群勾选全部：1-勾选了全部；0-未勾选全部（外联群 = groupInfo.type >= 10） */
  outreachGroupSelectAll?: PersonalAiFrameSelectAllFlag;
}

/** POST /agentSetDataRangeExpand/getAgentDataRange 完整回参 */
export type PersonalAiFrameGetAgentDataRangeResp =
  ApiResponse<PersonalAiFrameGetAgentDataRangeData>;
