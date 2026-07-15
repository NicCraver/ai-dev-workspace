/**
 * 契约：个人AI框域 · 查询常用语列表
 * POST /quickReply/list
 * Changelog:
 * - 2026-07-14 新增 POST /quickReply/list
 */

import type { ApiResponse } from '../_common';

/** 常用语类型：1-个人；2-群 */
export type PersonalAiFrameQuickReplyType = 1 | 2;

/** 常用语单项 */
export interface PersonalAiFrameQuickReplyItem {
  /** mock: '@string("number", 19)' */
  id?: string;
  /** 1-个人；2-群；mock: 1 */
  type?: PersonalAiFrameQuickReplyType;
  /** mock: '@ctitle(10, 30)' */
  content?: string;
  /** 创建人账号 id；mock: '280' */
  creator?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  createAt?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  updateAt?: string;
}

/** 常用语编辑权限 */
export interface PersonalAiFrameQuickReplyPermissions {
  /** 个人常用语是否可编辑；mock: true */
  personalCanEdit?: boolean;
  /** 群常用语是否可编辑；mock: false */
  groupCanEdit?: boolean;
}

/** POST /quickReply/list 入参 */
export interface PersonalAiFrameQuickReplyListReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 当前 AI 框智能体 id */
  agentId: string;
}

/** POST /quickReply/list 业务 data */
export interface PersonalAiFrameQuickReplyListData {
  /** 个人常用语列表 */
  personalList?: PersonalAiFrameQuickReplyItem[];
  /** 当前 AI 框对应群的群常用语列表 */
  groupList?: PersonalAiFrameQuickReplyItem[];
  /** 增删改权限 */
  permissions?: PersonalAiFrameQuickReplyPermissions;
}

/** POST /quickReply/list 完整回参 */
export type PersonalAiFrameQuickReplyListResp =
  ApiResponse<PersonalAiFrameQuickReplyListData>;
