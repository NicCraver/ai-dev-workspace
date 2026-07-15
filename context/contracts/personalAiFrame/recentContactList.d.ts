/**
 * 契约：个人AI框域 · 最近联系人补齐
 * POST /personalAiFrame/recentContactList
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/recentContactList
 * - 2026-07-14 对齐后端文档：群组项新增 owner/accountIdList/accountInfoList；群头像由前端拼 4 宫格
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAccountInfo } from './_shared';

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
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
  /** 前端传入的智信 wnsdk 最近联系人列表（id + type） */
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
  /** 群主账号 ID（type=1）；mock: 'u@string("number", 6)' */
  owner?: string;
  /** 群成员账号 ID 列表（type=1） */
  accountIdList?: string[];
  /**
   * 群成员信息列表（type=1）
   * 前端用其内 avatar 自行拼群头像：群主 + 3 个成员 4 宫格
   */
  accountInfoList?: PersonalAiFrameAccountInfo[];
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
