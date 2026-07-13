/**
 * 契约：个人AI框域 · 选择AI框弹窗搜索
 * POST /personalAiFrame/selectGroupBySearch
 * 用途：选择AI框弹窗内搜索（非弹窗本身）；空关键词时全量返回
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/selectGroupBySearch（选择AI框弹窗搜索）
 */

import type { ApiResponse } from '../_common';

/** POST /personalAiFrame/selectGroupBySearch 入参 */
export interface PersonalAiFrameSelectGroupBySearchReq {
  /** 当前登录账号 id；mock: 'u10086' */
  accountId: string;
  /** 模糊搜索内容（空时全量返回）；mock: '项目' */
  searchContent?: string;
}

/** 搜索结果 · 群组单项 */
export interface PersonalAiFrameSelectSearchGroupItem {
  /** 群 id；mock: 'g@string("number", 4)' */
  groupId?: string;
  /** 群名称；mock: '@cname()产品组' */
  groupName?: string;
  /** 群头像；mock: 'https://cdn.example.com/g@string("number", 4).png' */
  avatar?: string;
  /** 群人数；mock: @integer(5, 80) */
  groupNumber?: number;
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** 智能体名称；mock: '群@ctitle()助手' */
  agentName?: string;
  /** 是否已选中；mock: false */
  selected?: boolean;
}

/** 搜索结果 · 私聊单项 */
export interface PersonalAiFrameSelectSearchPrivateItem {
  /** 账号 id；mock: 'u@string("number", 6)' */
  accountId?: string;
  /** 昵称；mock: '@cname()' */
  nickName?: string;
  /** 头像；mock: 'https://cdn.example.com/u@string("number", 6).png' */
  avatar?: string;
  /** 智能体 id；mock: '@string("lower", 18)' */
  agentId?: string;
  /** AI框角色 id；mock: '@string("lower", 18)' */
  aiRoleId?: string;
  /** 智能体已发布版本 id；mock: '@string("lower", 18)' */
  agentVersionId?: string;
  /** 智能体名称；mock: '@cname()私人助理' */
  agentName?: string;
  /** 是否已选中；mock: false */
  selected?: boolean;
}

/** POST /personalAiFrame/selectGroupBySearch 业务 data */
export interface PersonalAiFrameSelectGroupBySearchData {
  /** 群组搜索结果 */
  groupList?: PersonalAiFrameSelectSearchGroupItem[];
  /** 私聊搜索结果 */
  privateList?: PersonalAiFrameSelectSearchPrivateItem[];
}

/** POST /personalAiFrame/selectGroupBySearch 完整回参 */
export type PersonalAiFrameSelectGroupBySearchResp =
  ApiResponse<PersonalAiFrameSelectGroupBySearchData>;
