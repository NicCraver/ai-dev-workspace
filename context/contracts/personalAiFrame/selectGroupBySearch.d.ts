/**
 * 契约：个人AI框域 · 选择AI框弹窗搜索
 * POST /personalAiFrame/selectGroupBySearch
 * 用途：选择AI框弹窗内搜索；空关键词时全量返回
 * Changelog:
 * - 2026-07-13 新增 POST /personalAiFrame/selectGroupBySearch
 * - 2026-07-14 对齐后端文档：群组项新增 owner/accountIdList/accountInfoList；群头像由前端拼 4 宫格
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameAccountInfo } from './_shared';

/** POST /personalAiFrame/selectGroupBySearch 入参 */
export interface PersonalAiFrameSelectGroupBySearchReq {
  /** 当前登录账号 id；mock: '280' */
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
  /** 群主账号 ID；mock: 'u@string("number", 6)' */
  owner?: string;
  /** 群成员账号 ID 列表 */
  accountIdList?: string[];
  /**
   * 群成员信息列表
   * 前端用其内 avatar 自行拼群头像：群主 + 3 个成员 4 宫格
   */
  accountInfoList?: PersonalAiFrameAccountInfo[];
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
  /** 群组搜索结果；群按群名/群AI框名 OR 去重 */
  groupList?: PersonalAiFrameSelectSearchGroupItem[];
  /** 私聊搜索结果；私聊按人名/私聊AI框名 OR 去重 */
  privateList?: PersonalAiFrameSelectSearchPrivateItem[];
}

/** POST /personalAiFrame/selectGroupBySearch 完整回参 */
export type PersonalAiFrameSelectGroupBySearchResp =
  ApiResponse<PersonalAiFrameSelectGroupBySearchData>;
