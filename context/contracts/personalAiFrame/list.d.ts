/**
 * 契约：个人AI框域 · 获取列表
 * POST /personalAiFrame/list
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/list（获取个人AI框列表）
 * - 2026-07-13 入参移除 selectCorpId；accountId mock 改为 '280'
 */

import type { ApiResponse } from '../_common';

/** 筛选类型：0-全部；1-仅近15天问答；2-仅有知识库（个人AI框不受影响） */
export type PersonalAiFrameFilterType = 0 | 1 | 2;

/** 归属类型：0-个人AI框；1-私聊；3-群聊（无 2） */
export type PersonalAiFrameBelongType = 0 | 1 | 3;

/** POST /personalAiFrame/list 入参 */
export interface PersonalAiFrameListReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 筛选类型：0-全部；1-仅近15天问答；2-仅有知识库；默认不传视为全部；mock: 0 */
  filterType?: PersonalAiFrameFilterType;
  /** 搜索关键词（可搜联系人名称、AI框名称）；mock: '项目' */
  searchKeyword?: string;
}

/** AI框列表单项 */
export interface PersonalAiFrameItem {
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** AI框头像 */
  avatar?: string;
  /** AI框名称 */
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
  /** 条件类型；当前固定 'im'；mock: 'im' */
  conditionType?: string;
  /** 是否置顶；mock: false */
  isPinned?: boolean;
  /** 置顶时间；格式 yyyy-MM-dd HH:mm:ss */
  pinTime?: string;
  /** 是否有知识库；mock: true */
  hasKnowledge?: boolean;
  /** 最近对话时间；格式 yyyy-MM-dd HH:mm:ss */
  lastChatTime?: string;
  /** 未读角标数；mock: 0 */
  unreadCount?: number;
  /** 24小时内是否有活跃会话；mock: true */
  hasRecentSession?: boolean;
}

/** 筛选勾选态（回传当前生效的筛选 UI 状态） */
export interface PersonalAiFrameFilterInfo {
  /** 个人AI框是否勾选（始终 true）；mock: true */
  personalChecked?: boolean;
  /** 近15天问答的AI框是否勾选；mock: true */
  recentChatChecked?: boolean;
  /** 有知识库的AI框是否勾选；mock: false */
  hasKnowledgeChecked?: boolean;
}

/** POST /personalAiFrame/list 业务 data */
export interface PersonalAiFrameListData {
  aiFrameList?: PersonalAiFrameItem[];
  filterInfo?: PersonalAiFrameFilterInfo;
}

/** POST /personalAiFrame/list 完整回参 */
export type PersonalAiFrameListResp = ApiResponse<PersonalAiFrameListData>;
