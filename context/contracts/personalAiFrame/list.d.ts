/**
 * 契约：个人AI框域 · 获取列表
 * POST /personalAiFrame/list
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/list（获取个人AI框列表）
 * - 2026-07-13 入参移除 selectCorpId；accountId mock 改为 '280'
 * - 2026-07-14 入参 `filterType` 改为 `filterTypes`（多选 1/2）；移除 `searchKeyword`
 * - 2026-07-14 回参单项新增 `isPersonal`/`latestMessageBrief`；`filterInfo` 改为 `filterTypes` 数组
 * - 2026-07-14 对齐后端文档：新增 `lastMessageTime`
 * - 2026-07-14 `exemptAgentIds` 保留为 @unconfirmed（web 选中后豁免用，YApi 文档未列）
 * - 2026-07-14 筛选类型 `PersonalAiFrameFilterType` / `PersonalAiFrameFilterInfo` 迁至 `_shared.d.ts`（与 getFilter 共用）
 * - 2026-07-16 筛选写入亦可走 POST /personalAiFrame/saveFilter；本接口带 filterTypes 时仍会隐式落库（与 saveFilter 等价）
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameFilterInfo,
  PersonalAiFrameFilterType,
} from './_shared';

export type { PersonalAiFrameFilterInfo, PersonalAiFrameFilterType };

/** 归属类型：0-个人AI框；1-私聊；3-群聊（无 2） */
export type PersonalAiFrameBelongType = 0 | 1 | 3;

/** 最近 24h 最新消息缩略 · sender */
export type PersonalAiFrameLatestMessageSender = 'user' | 'assistant';

/** POST /personalAiFrame/list 入参 */
export interface PersonalAiFrameListReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /**
   * 筛选类型（多选）
   * - `null`/不传：沿用上次记忆
   * - `[]`：全部并落库
   * - `[1]`：仅近15天问答
   * - `[2]`：仅有知识库
   * - `[1,2]`：同时满足
   */
  filterTypes?: PersonalAiFrameFilterType[] | null;
  /**
   * @unconfirmed 筛选豁免名单（agentId 列表）；web 选中后 push，YApi 文档未列
   */
  exemptAgentIds?: string[];
}

/** 最近 24h 最新消息缩略（null 表示 24h 内无消息） */
export interface PersonalAiFrameLatestMessageBrief {
  /** mock: 'uuid-@string("lower", 16)' */
  uuid?: string;
  /** mock: '@string("lower", 18)' */
  sessionId?: string;
  /** user / assistant；mock: 'user' */
  sender?: PersonalAiFrameLatestMessageSender;
  /** 用户提问（明文）；mock: '@cparagraph(1)' */
  question?: string;
  /** AI 回答（明文）；mock: '@cparagraph(1)' */
  answer?: string;
  /** 最终完成时间；格式 yyyy-MM-dd HH:mm:ss */
  finishAt?: string;
}

/** AI框列表单项 */
export interface PersonalAiFrameItem {
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** AI框头像；mock: 'https://cdn.example.com/avatar/@string("lower", 8).png' */
  avatar?: string;
  /** AI框名称；mock: '@cname()' */
  name?: string;
  /**
   * 归属名称
   * 个人AI框='个人AI框'；群=群名称；私聊=对方姓名
   */
  belongName?: string;
  /** 归属类型：0-个人AI框；1-私聊；3-群聊；mock: 0 */
  belongType?: PersonalAiFrameBelongType;
  /** 归属 id；mock: '@string("lower", 18)' */
  belongId?: string;
  /** 企业 id；mock: 'c1' */
  corpId?: string;
  /** 条件类型：im；mock: 'im' */
  conditionType?: string;
  /** 是否置顶；mock: false */
  isPinned?: boolean;
  /** 置顶时间；格式 yyyy-MM-dd HH:mm:ss */
  pinTime?: string;
  /** 是否个人 AI 框（belongType=0，O(1) 直接判定）；mock: false */
  isPersonal?: boolean;
  /** 是否有知识库；mock: true */
  hasKnowledge?: boolean;
  /**
   * 近15天是否有问答
   * 链路：agentVersionId → ai_session.sessionId → Mongo session_chat_message.finishAt
   */
  hasRecentSession?: boolean;
  /** 最近对话时间（ai_session.updateAt）；格式 yyyy-MM-dd HH:mm:ss */
  lastChatTime?: string;
  /**
   * 黄色角标数量
   * 直接从 ai_frame_user_setting.unreadCount 读取；mock: 0
   */
  unreadCount?: number;
  /**
   * 最新产生时间
   * 直接从 ai_frame_user_setting.lastMessageTime 读取（其他同学在收到新消息时更新）；个人AI框为 null
   * 格式 yyyy-MM-dd HH:mm:ss
   */
  lastMessageTime?: string | null;
  /**
   * 最近 24h 最新消息缩略（null 表示 24h 内无消息）
   * 链路：ai_session (MySQL) 按 agentVersionId 取 sessionId → Mongo session_chat_message
   * 取每个 sessionId 下 finishAt 最大的消息，满足 finishAt >= now-24h 才填充；question/answer 已解密
   */
  latestMessageBrief?: PersonalAiFrameLatestMessageBrief | null;
}

/** POST /personalAiFrame/list 业务 data */
export interface PersonalAiFrameListData {
  aiFrameList?: PersonalAiFrameItem[];
  filterInfo?: PersonalAiFrameFilterInfo;
}

/** POST /personalAiFrame/list 完整回参 */
export type PersonalAiFrameListResp = ApiResponse<PersonalAiFrameListData>;
