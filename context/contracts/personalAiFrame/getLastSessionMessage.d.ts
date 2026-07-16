/**
 * 契约：个人AI框域 · 获取会话框展示内容
 * POST /sessionMsg/getLastSessionMessage
 * 用途：点击 AI 框打开时调用，不确定是否有 AI 会话记录
 * Changelog:
 * - 2026-07-14 新增 POST /sessionMsg/getLastSessionMessage
 * - 2026-07-16 对齐 YApi：入参新增 `code`；`wpsCode` 标 @unconfirmed（web 现网发送、文档未列）；
 *   `agentSetDataRangeExpandVo` 子项 dataRangeType/choose 必填，dataRangeType 含 3-个人知识/4-共享知识；
 *   `agentVersionId` 注释改为「智能体设置版本 id」
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameAttachment,
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameDataRangeScope,
  PersonalAiFrameGuideQuestion,
} from './_shared';

/** ai 会话归属条件类型 */
export type PersonalAiFrameSessionConditionType = 'im' | 'zhiYou';

/** 展示类型：0-无历史会话展示问候语；1-展示历史会话 */
export type PersonalAiFrameLastSessionDisplayType = 0 | 1;

/** 消息发送人角色：user-用户；assistant-ai助手；system-系统角色 */
export type PersonalAiFrameSessionSenderRole = 'user' | 'assistant' | 'system';

/** 消息状态：1-回答进行中；2-停止回答；3-回答异常终止；4-完成回答 */
export type PersonalAiFrameSessionMessageStatus = 1 | 2 | 3 | 4;

/** POST /sessionMsg/getLastSessionMessage 入参 */
export interface PersonalAiFrameGetLastSessionMessageReq {
  /** 当前用户账号 id */
  accountId?: string;
  /** ai 会话归属条件类型：im-聊天消息；zhiYou-智邮 */
  conditionType: PersonalAiFrameSessionConditionType | string;
  /**
   * 归属 id
   * im 会话 id 或 邮件 id 或 子项目 id 或 主项目 id
   */
  belongId: string;
  /**
   * 归属类型
   * im：1-私聊；3-群聊
   * mail/zhiYou：1-单邮件；2-子项目；3-主项目
   */
  belongType: number;
  /** ai 框角色 id */
  aiRoleId: string;
  /** 智能体模式：智能体调试 id；预览调试时必传 */
  previewDebugId?: string;
  /**
   * 授权/业务 code（如飞书授权回传）
   * web 现网传 feishuCode
   */
  code?: string;
  /**
   * @unconfirmed YApi 未列；web 现网传 wps 授权 code（错误码 N_L_C_00002 重试时）
   */
  wpsCode?: string;
}

/** 业务系统筛选 · 选择对象 */
export interface PersonalAiFrameSessionChooseItem {
  /** im：会话 id；zhiYou：邮件/子项目/主项目 id */
  id?: string;
  /**
   * im：1-私聊；3-群聊
   * zhiYou：1-单邮件；2-子项目；3-主项目
   */
  type?: number;
  /** im：会话名称；zhiYou：邮件/子项目/主项目名称 */
  name?: string;
}

/** 业务系统筛选 · im 差异化参数 */
export interface PersonalAiFrameSessionConditionParaIm {
  /** 复制消息摘要（100 字符），searchType=1 时有值 */
  copyMsgRemark?: string;
  /** 复制消息的 uuid 集合，searchType=1 时有值 */
  copyMsgUuidList?: string[];
  /** 选择的时间条件类型，searchType=0 时有值 */
  timeType?: number;
}

/** 业务系统筛选 · zhiYou 差异化参数 */
export interface PersonalAiFrameSessionConditionParaZhiYou {
  senderId?: string;
  senderName?: string;
  /** 邮件发送时间 */
  sendTime?: string;
}

/** 业务系统筛选条件 */
export interface PersonalAiFrameSessionConditionPara {
  belongId?: string;
  belongType?: number;
  belongName?: string;
  /**
   * 查询类型
   * im：0-时间条件查询；1-复制消息查询
   * zhiYou：0-无；1-需要查询邮件/子项目/主项目
   */
  searchType?: number;
  chooseList?: PersonalAiFrameSessionChooseItem[];
  im?: PersonalAiFrameSessionConditionParaIm;
  zhiYou?: PersonalAiFrameSessionConditionParaZhiYou;
}

/** 历史会话首页附加信息 */
export interface PersonalAiFrameSessionHistoryPara {
  /**
   * 是否有正在活跃的问答请求
   * 活跃中不能发起新提问，前端需调用 aiChat 接口继续问答流响应
   */
  hasActiveQuery?: boolean;
  /** 深度思考：0-未开启；1-开启 */
  hasDeepThink?: number;
  /** 联网搜索：0-未开启；1-开启 */
  hasNetSearch?: number;
  /** 模型名称，如 deepSeek */
  aiName?: string;
  conditionType?: string;
  /** 最近一次会话的智能体数据范围 */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  conditionPara?: PersonalAiFrameSessionConditionPara;
}

/** 业务系统查询结果引用 */
export interface PersonalAiFrameSessionBusinessReference {
  id?: string;
  type?: number;
  name?: string;
  msgCount?: number;
}

/** 联网检索结果引用 */
export interface PersonalAiFrameSessionNetReference {
  logoUrl?: string;
  url?: string;
  /** 移动端链接，可能为空 */
  mobileUrl?: string;
  title?: string;
  siteName?: string;
  publishTime?: string;
}

/** 参考资料（聊天检索记录、联网搜索链接） */
export interface PersonalAiFrameSessionMessageReference {
  businessReferenceList?: PersonalAiFrameSessionBusinessReference[];
  netReferenceList?: PersonalAiFrameSessionNetReference[];
}

/** 消息错误信息（status=3 时有值） */
export interface PersonalAiFrameSessionMessageError {
  errorCode?: string;
  errorMsg?: string;
}

/** 知识来源文档 */
export interface PersonalAiFrameSessionKnowledgeDoc {
  docId?: string;
  docName?: string;
  /**
   * 来源类型
   * 0-聊天中的文件；1-自主本地上传；2-智文；3-飞书；4-公开链接
   */
  fromType?: number;
  docType?: string;
  docSize?: number;
  imagePreviewUrl?: string;
}

/** 会话消息单项 */
export interface PersonalAiFrameSessionMessageItem {
  id?: string;
  sessionId?: string;
  uuid?: string;
  senderRole?: PersonalAiFrameSessionSenderRole | string;
  /** user=用户账号 id；assistant=ai 助手角色 id */
  senderId?: string;
  senderName?: string;
  avatar?: string;
  conditionType?: string;
  aiName?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  createAt?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  finishAt?: string;
  /**
   * senderRole=user：提示词（问题）
   * senderRole=assistant：回答正文
   * senderRole=system：系统角色
   */
  content?: string;
  /** senderRole=user 时有值；自动生成的问题标题 */
  titleName?: string;
  /** senderRole=user 时有值 */
  conditionPara?: PersonalAiFrameSessionConditionPara;
  /** senderRole=user 时有值；本次提问选中的数据源列表 */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** senderRole=user 时有值 */
  attachmentList?: PersonalAiFrameAttachment[];
  /** senderRole=assistant 时有值 */
  reference?: PersonalAiFrameSessionMessageReference;
  /** senderRole=assistant 时有值；深度思考内容 */
  reasoningContent?: string;
  status?: PersonalAiFrameSessionMessageStatus;
  error?: PersonalAiFrameSessionMessageError;
  /** 0-不显示知识来源；1-显示知识来源 */
  showKnowledgeFrom?: number;
  knowledgeDocList?: PersonalAiFrameSessionKnowledgeDoc[];
}

/** 最近 1 个 ai 会话首页信息 */
export interface PersonalAiFrameLastSessionInfo {
  pageCount?: number;
  hasNextPage?: boolean;
  sessionId?: string;
  sessionName?: string;
  historyPara?: PersonalAiFrameSessionHistoryPara;
  /** 问答列表，按时间正序 */
  messageList?: PersonalAiFrameSessionMessageItem[];
}

/** ai 框角色信息 */
export interface PersonalAiFrameSessionAiRoleInfo {
  aiRoleId?: string;
  agentId?: string;
  /** 智能体设置版本 id */
  agentVersionId?: string;
  /** 0-不可以编辑智能体；1-可以编辑智能体 */
  canEditAgent?: number;
  corpId?: string;
  conditionType?: string;
  name?: string;
  avatar?: string;
  greeting?: string;
  greetingAttachmentList?: PersonalAiFrameAttachment[];
  greetingGuideQuestionList?: PersonalAiFrameGuideQuestion[];
  /** 智能体可选数据范围，默认选中 */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** 0-不展示知识来源；1-展示知识来源 */
  showKnowledgeFrom?: number;
}

/**
 * 聊天中存的选中数据 · 知识范围单项（dataRangeType / choose 必填）
 * dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人知识；4-共享知识
 */
export type PersonalAiFrameAgentSetDataRangeItem = Required<
  Pick<PersonalAiFrameDataRangeChoose, 'dataRangeType' | 'choose'>
>;

/** 聊天中存的选中数据（回参必填） */
export interface PersonalAiFrameAgentSetDataRangeExpandVo {
  /** 选择的时间类型 */
  timeType: number;
  /** 智能体知识范围 */
  dataRangeList: PersonalAiFrameAgentSetDataRangeItem[];
  /** 联网搜索：0-未开启；1-开启 */
  netSearch: number;
  /** 深度思考：0-未开启；1-开启 */
  deepThink: number;
  /**
   * 数据范围（人和群）
   * 子项必填：scopeDataType（1-私聊；3-群聊）、scopeDataId（私聊=人员 id；群聊=群组 id）
   */
  dataRangeScopeList: PersonalAiFrameDataRangeScope[];
}

/** POST /sessionMsg/getLastSessionMessage 业务 data */
export interface PersonalAiFrameGetLastSessionMessageData {
  /** 0-没有历史会话展示问候语；1-展示历史会话 */
  type?: PersonalAiFrameLastSessionDisplayType;
  lastSessionInfo?: PersonalAiFrameLastSessionInfo;
  aiRoleInfo?: PersonalAiFrameSessionAiRoleInfo;
  /** 聊天中存的选中数据 */
  agentSetDataRangeExpandVo: PersonalAiFrameAgentSetDataRangeExpandVo;
}

/** POST /sessionMsg/getLastSessionMessage 完整回参 */
export type PersonalAiFrameGetLastSessionMessageResp =
  ApiResponse<PersonalAiFrameGetLastSessionMessageData>;
