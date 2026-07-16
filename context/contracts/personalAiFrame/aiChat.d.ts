/**
 * 契约：个人AI框域 · 会话问答流式接口
 * POST /v1/aiChat
 * 分类：流式会话接口（SSE）
 * Changelog:
 * - 2026-07-16 新增 POST /v1/aiChat（对齐后端文档）；入参含 dataRangeScopeList；
 *   附件 analysisStatus 补 3-大小超限（见 _shared）；SSE 分片回参按 web 现网消费标注 @unconfirmed
 */

import type {
  PersonalAiFrameAttachment,
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameDataRangeScope,
} from './_shared';
import type { PersonalAiFrameSessionConditionPara } from './getLastSessionMessage';

/** 本次请求类型：1-继续进行中问答（刷新/切会话）；非 1-新问答 */
export type PersonalAiFrameAiChatType = 0 | 1;

/** 模型名称 */
export type PersonalAiFrameAiModelName = 'deepSeek' | 'kimi' | 'doubao' | string;

/** 条件类型：im-聊天消息；zhiYou-智邮 */
export type PersonalAiFrameAiChatConditionType = 'im' | 'zhiYou' | string;

/** POST /v1/aiChat 请求头（除 Content-Type / Authorization 外） */
export interface PersonalAiFrameAiChatHeaders {
  /** 企业 id */
  zxCorpId: string;
  /** 账号 id */
  zxAccountId: string;
}

/** POST /v1/aiChat 入参 */
export interface PersonalAiFrameAiChatReq {
  /**
   * 本次请求类型标记
   * 传 1：当前会话正在问答中，继续接口（页面刷新或切换会话）
   * 非 1：新的问答
   */
  chatType?: PersonalAiFrameAiChatType | number;
  /** 会话 id；chatType 为 1 时必传 */
  sessionId?: string;
  /** ai 框角色 id */
  aiRoleId?: string;
  /** 自动生成的问题标题；每次提问必传 */
  titleName?: string;
  /** 问题提示词；chatType 非 1 时必传 */
  prompt?: string;
  /** 条件类型：im-聊天消息；zhiYou-智邮 */
  conditionType?: PersonalAiFrameAiChatConditionType;
  /** 当前用户的企业用户 id；企业微应用使用 AI 时必传 */
  userId?: string;
  /** 业务系统数据查询参数 */
  conditionPara?: PersonalAiFrameSessionConditionPara;
  /**
   * 模型名称：deepSeek、kimi、doubao
   * chatType 非 1 时必传
   */
  aiName?: PersonalAiFrameAiModelName;
  /** 深度思考：0-未开启；1-开启 */
  deepThink?: number;
  /** 联网搜索：0-未开启；1-开启 */
  netSearch?: number;
  /** 附件列表 */
  attachmentList?: PersonalAiFrameAttachment[];
  /** 智能体 id */
  agentId?: string;
  /** 智能体版本 id */
  agentVersionId?: string;
  /** 智能体预览调试 id */
  previewDebugId?: string;
  /**
   * 智能体数据范围
   * 单项 dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件
   * （与 saveDataRange 共用类型时还可含 3-个人 / 4-分享）
   * 单项 choose：0-未选中；1-选中
   */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /**
   * 智能体数据范围（人和群）
   * 子项必填：scopeDataType（1-私聊；3-群聊）、scopeDataId（私聊=人员 id；群聊=群组 id）
   */
  dataRangeScopeList: PersonalAiFrameDataRangeScope[];
  /**
   * @unconfirmed YApi 未列；web 现网发送（多模态回答类型）
   */
  answerType?: number;
  /**
   * @unconfirmed YApi 未列；web 现网「重新生成」时发送
   */
  refreshAnswerId?: string;
  /**
   * @unconfirmed YApi 未列；web 现网多模态导出时发送
   */
  commandSourceAnswerId?: string;
}

/**
 * SSE 单条事件 data（JSON）
 * @unconfirmed YApi 响应示例为空 schema；字段按 web Chat.vue 现网消费整理，联调后校正
 */
export interface PersonalAiFrameAiChatStreamChunk {
  /** 业务错误码（有值表示失败） */
  code?: string;
  /** 错误文案 */
  errorMsg?: string;
  /** 会话 id */
  sessionId?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 回答正文增量 */
  content?: string;
  /** 深度思考内容增量 */
  reasoningContent?: string;
  /** 是否结束 */
  finished?: boolean;
  /** 消息状态（结束时）；见 getLastSessionMessage 的 status 枚举 */
  status?: number;
  /** 回答类型（结束时） */
  answerType?: number;
  /** 回答消息 id（结束时） */
  answerId?: string;
  /** 对应提问 id（结束时） */
  questionId?: string;
  /** 进度 0–100 */
  progressCode?: number;
  /** 进度文案 */
  progressName?: string;
  /** 参考文献 */
  reference?: Record<string, unknown>;
  /** 知识来源 */
  knowledgeInfo?: Record<string, unknown>;
  /** 多模态结果列表（结束时） */
  multimodalResultList?: unknown[];
  /** 可再生成类型列表（结束时） */
  canGenerateList?: unknown[];
}
