/**
 * 契约：个人AI框域 · 保存/发布 Agent 设置信息（不含知识库）
 * POST /agentSetBasic/saveAgentSetInfo
 * Changelog:
 * - 2026-09-01 dataRangeList 增加 5-周工作；ability.eventTaskList.dealMeans.aiParaInfo
 *   增加 weekWorkScopeList 与 8 个 weekWorkSelectAll*（showRangeTxt 本接口入参文档未列）。
 * - 2026-08-12 fixedTimeTask 的 selectMyAiBox / sendAiMessageScopeVOList / displayFormat 改为可选（get 回参不含）
 * - 2026-07-14 新增 POST /agentSetBasic/saveAgentSetInfo
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameAttachment,
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameGuideQuestion,
  PersonalAiFrameWeekWorkFields,
} from './_shared';

/** 操作类型：0-保存并预览；1-发布 */
export type PersonalAiFrameAgentSetOperateType = 0 | 1;

/** 人设 */
export interface PersonalAiFrameAgentSetPersona {
  avatar?: string;
  name?: string;
  remark?: string;
  roleMsg?: string;
  greeting?: string;
  greetAttList?: PersonalAiFrameAttachment[];
  greetGuideQList?: PersonalAiFrameGuideQuestion[];
}

/** 记忆设置 */
export interface PersonalAiFrameAgentSetMemory {
  /** 1-开启多轮会话 */
  openMoreRound?: number;
  /** 多轮会话轮数 [0,20] */
  rounds?: number;
  /** 1-开启长期记忆 */
  openLongMemory?: number;
}

/** 知识范围配置项 */
export interface PersonalAiFrameAgentSetDataRangeConfig {
  id?: string;
  creator?: string;
  createAt?: string;
  updator?: string;
  updateAt?: string;
  agentVersionId?: string;
  /**
   * 智能体数据范围
   * 0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；5-周工作
   */
  dataType?: number;
  /** 0-禁用；1-启用 */
  status?: number;
}

/** 知识-问答设置 */
export interface PersonalAiFrameAgentSetQaSet {
  dataRangeList?: PersonalAiFrameAgentSetDataRangeConfig[];
  /** 1-展示知识来源 */
  showKnowledgeFrom?: number;
  /** 1-使用托底回复 */
  useBottomReply?: number;
  bottomReplyTxt?: string;
  /** 知识切片召回数量 [1,20] */
  knowledgeSliceNumber?: number;
  /** 知识切片匹配度阈值 [0.01,0.9] */
  knowledgeSliceDegree?: number;
}

/** 推送 AI 框分析参数 */
export interface PersonalAiFrameAgentSetAiParaInfo
  extends PersonalAiFrameWeekWorkFields {
  /**
   * 单项 dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人；4-分享；5-周工作
   */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** 聊天文本选择的时间条件类型 */
  timeType?: number;
  /** 聊天文件选择的时间条件类型 */
  chatFileTimeType?: number;
}

/** 执行方式 */
export interface PersonalAiFrameAgentSetDealMean {
  id?: string;
  /** 0-固定文本；1-推送 AI 框分析 */
  dealType?: number;
  /** 固定文本内容或 AI 分析提示词 */
  fixedTxt?: string;
  fixedAttachmentList?: PersonalAiFrameAttachment[];
  aiParaInfo?: PersonalAiFrameAgentSetAiParaInfo;
}

/** 定时发送范围 */
export interface PersonalAiFrameAgentSetSendScope {
  /** 1-私聊；3-群聊 */
  scopeDataType: number;
  /** 私聊=人员 id；群聊=群组 id */
  scopeDataId: string;
}

/** 触发技能-定时触发 */
export interface PersonalAiFrameAgentSetFixedTimeTask {
  id?: string;
  agentVersionId?: string;
  name?: string;
  /** 0-关闭；1-启用 */
  used?: number;
  orderIndex?: number;
  /** 每 N 个周期 (1~365) */
  cycleValue?: number;
  /** 周期单位：day、week、month、stage、quarter、year */
  cycleUnit?: string;
  /** 时:分 */
  time?: string;
  /** 跳过美腾节日：1-跳过 */
  skipHoliday?: number;
  /** 周多选：日、一、二…六 */
  weekDays?: string[];
  /** 月模式：1-某日；2-倒数第几天 */
  monthMode?: number;
  monthDays?: number[];
  monthCountdown?: number;
  /** 阶段模式：1-第几天；2-倒数第几天 */
  stageMode?: number;
  stageDay?: number;
  stageCountdown?: number;
  /** 季模式：1-第几月；2-倒数第几天 */
  quarterMode?: number;
  quarterMonth?: number;
  quarterDays?: number[];
  quarterCountdown?: number;
  /** 年模式：1-第几月；2-倒数第几天 */
  yearMode?: number;
  yearMonth?: number;
  yearDays?: number[];
  yearCountdown?: number;
  dealMeans?: PersonalAiFrameAgentSetDealMean[];
  /** 勾选我的 AI 框：1-勾选；0-未勾选（save 入参必填；get 回参无此字段） */
  selectMyAiBox?: number;
  /** 定时发送范围（save 入参必填；get 回参无此字段） */
  sendAiMessageScopeVOList?: PersonalAiFrameAgentSetSendScope[];
  /** 展示形式：1-个人智能体发送；2-以人的形式发送（save 入参必填；get 回参无此字段） */
  displayFormat?: number;
}

/** 触发技能-条件触发 */
export interface PersonalAiFrameAgentSetEventTask {
  id?: string;
  agentVersionId?: string;
  name?: string;
  used?: number;
  orderIndex?: number;
  /**
   * 事件触发类型
   * 1-群加人；2-移除群成员；3-主动退群；4-更换群主；5-更换 AI 框管理员；6-添加 AI 框子管理员
   */
  eventType?: number;
  dealMeans?: PersonalAiFrameAgentSetDealMean[];
}

/** 技能 */
export interface PersonalAiFrameAgentSetAbility {
  fixedTimeTaskList?: PersonalAiFrameAgentSetFixedTimeTask[];
  eventTaskList?: PersonalAiFrameAgentSetEventTask[];
}

/** 管理员 */
export interface PersonalAiFrameAgentSetManager {
  id?: string;
  agentVersionId?: string;
  accountId?: string;
  nickName?: string;
  avatar?: string;
  /** 0-主管理员；1-子管理员 */
  managerType?: number;
  /** 0-不是群主；1-是群主 */
  groupOwn?: number;
  createAt?: string;
}

/** 权限 */
export interface PersonalAiFrameAgentSetAuthority {
  mainManagerList?: PersonalAiFrameAgentSetManager[];
  /** 0-不可以；1-可以转让主管理员 */
  canChangeMainManager?: number;
  childManagerList?: PersonalAiFrameAgentSetManager[];
  /** 0-不可以；1-可以添加子管理员 */
  canAddChildManager?: number;
  /**
   * 0-遵循知识自身权限设置（默认）
   * 1-基于全量知识问答
   */
  memberKnowledgePer?: number;
}

/** POST /agentSetBasic/saveAgentSetInfo 入参 */
export interface PersonalAiFrameSaveAgentSetInfoReq {
  accountId: string;
  agentId: string;
  agentVersionId: string;
  operateType: PersonalAiFrameAgentSetOperateType;
  persona?: PersonalAiFrameAgentSetPersona;
  memory?: PersonalAiFrameAgentSetMemory;
  qaSetVO?: PersonalAiFrameAgentSetQaSet;
  ability?: PersonalAiFrameAgentSetAbility;
  authority?: PersonalAiFrameAgentSetAuthority;
}

/** POST /agentSetBasic/saveAgentSetInfo 业务 data（回显编辑态） */
export interface PersonalAiFrameSaveAgentSetInfoData {
  aiRoleId?: string;
  conditionType?: string;
  belongId?: string;
  belongType?: number;
  belongTypeName?: string;
  agentId?: string;
  agentVersionId?: string;
  /** 预览调试 id；预览调试时需要 */
  previewDebugId?: string;
  /** 0-较发布版本没有修改；1-有修改 */
  hasModify?: number;
  /** 0-没有智文；1-有智文 */
  hasZhiWen?: number;
  /** 0-没有飞书；1-有飞书 */
  hasFeiShu?: number;
  persona?: PersonalAiFrameAgentSetPersona;
  memory?: PersonalAiFrameAgentSetMemory;
  qaSetVO?: PersonalAiFrameAgentSetQaSet;
  ability?: PersonalAiFrameAgentSetAbility;
  authority?: PersonalAiFrameAgentSetAuthority;
}

/** POST /agentSetBasic/saveAgentSetInfo 完整回参 */
export type PersonalAiFrameSaveAgentSetInfoResp =
  ApiResponse<PersonalAiFrameSaveAgentSetInfoData>;
