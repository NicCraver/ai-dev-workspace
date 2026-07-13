/**
 * 契约：个人AI框域 · 最近联系人补齐
 * POST /personalAiFrame/recentContactList
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/recentContactList（选择AI框-最近联系人）
 */

import type { ApiResponse } from '../_common';

/** 最近联系人类型：1-群组；2-个人 */
export type PersonalAiFrameRecentContactType = '1' | '2';

/** POST /personalAiFrame/recentContactList 入参单项 */
export interface PersonalAiFrameRecentContactReqItem {
  /** 联系人/群 id；mock: 'id@string("number", 4)' */
  id?: string;
  /** 1 群组 / 2 个人；mock: '1' */
  type?: PersonalAiFrameRecentContactType;
}

/** POST /personalAiFrame/recentContactList 入参 */
export interface PersonalAiFrameRecentContactListReq {
  /** 当前登录账号 id；mock: 'u10086' */
  accountId: string;
  /** 待查询的最近联系人列表 */
  items: PersonalAiFrameRecentContactReqItem[];
}

/** POST /personalAiFrame/recentContactList 回参单项 */
export interface PersonalAiFrameRecentContactItem {
  /** 联系人/群 id；mock: 'id@string("number", 4)' */
  id?: string;
  /** 1 群组 / 2 个人；mock: '1' */
  type?: PersonalAiFrameRecentContactType;
  /** 群 id（type=1）；mock: 'g@string("number", 4)' */
  groupId?: string;
  /** 群名称（type=1）；mock: '@cname()项目组' */
  groupName?: string;
  /** 群头像（type=1）；mock: 'https://cdn.example.com/g@string("number", 4).png' */
  groupAvatar?: string;
  /** 账号 id（type=2）；mock: 'u@string("number", 6)' */
  accountId?: string;
  /** 昵称（type=2）；mock: '@cname()' */
  nickName?: string;
  /** 头像（type=2）；mock: 'https://cdn.example.com/u@string("number", 6).png' */
  avatar?: string;
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** 智能体名称；mock: '@cname()智能体' */
  agentName?: string;
}

/** POST /personalAiFrame/recentContactList 业务 data */
export interface PersonalAiFrameRecentContactListData {
  items?: PersonalAiFrameRecentContactItem[];
}

/** POST /personalAiFrame/recentContactList 完整回参 */
export type PersonalAiFrameRecentContactListResp =
  ApiResponse<PersonalAiFrameRecentContactListData>;
