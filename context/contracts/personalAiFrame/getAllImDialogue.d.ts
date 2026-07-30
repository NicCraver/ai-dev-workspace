/**
 * 契约：个人AI框域 · 获取所有IM会话
 * POST /personalAiFrame/getAllImDialogue
 * 用途：① 个人 AI 框选会话 / 选智能体时拉取全部 IM 会话列表；
 *       ② 四端「选择数据来源」弹窗的候选清单（全量人 + 群，一次拉取、弹窗内存缓存）
 * Changelog:
 * - 2026-07-30 「选择 AI 框」web：**不再** `agentItemsOnly` 过滤无 agentId；列表/侧栏搜展示全量归一化项。
 * - 2026-07-30 「选择数据来源」与「选择 AI 框」：私聊 `privateInfo.leave === 1` 时展示名后缀 `（已离职）`
 *   （web 分别在 dataScopeModel / aiBoxPickerModel normalize；搜索/列表同源）。
 * - 2026-07-30 选择 AI 框不再调 batchGetAgent：直接信 getAllImDialogue(selectModel=1)
 *   回参 agent 字段（曾一度用 agentItemsOnly 滤无 agentId，现已取消过滤）。
 * - 2026-07-29 联调确认：selectModel=1 曾可能返回 agentId/agentName/agentAvatar 全为 null；
 *   现消费方不再二次 batchGetAgent，且展示层不过滤无 agentId。
 * - 2026-07-29 新增消费方：web「选择 AI 框」弹窗（selectModel 传 1）。
 *   忽略 selected 字段作为弹窗选中态。
 * - 2026-07-29 新增消费方：四端「选择数据来源」弹窗（selectModel 传 0）。
 *   注意：本接口的 selected 字段来自 ai_frame_user_setting，是个人 AI 框「列表」的选中态，
 *   与 DataScope 无关；弹窗已选态一律以 getAgentDataRange 的 dataRangeScopeList 为准。
 * - 2026-07-28 新增 POST /personalAiFrame/getAllImDialogue
 */

import type { ApiResponse } from '../_common';

/**
 * 选择模式
 * 0-个人ai框选会话模式（默认）
 * 1-个人ai框选智能体模式
 */
export type PersonalAiFrameImDialogueSelectModel = 0 | 1;

/** 会话类型：1-私聊；3-群聊 */
export type PersonalAiFrameImDialogueType = 1 | 3;

/** POST /personalAiFrame/getAllImDialogue 入参 */
export interface PersonalAiFrameGetAllImDialogueReq {
  /** 账号 id；mock: '280' */
  accountId: string;
  /**
   * 选择模式
   * 0-个人ai框选会话模式（默认）；1-个人ai框选智能体模式
   * mock: 0
   */
  selectModel: PersonalAiFrameImDialogueSelectModel;
}

/** 私聊信息（type=1 时有值） */
export interface PersonalAiFrameImDialoguePrivateInfo {
  /** 私聊对方的头像链接；mock: 'https://cdn.example.com/u@string("number", 6).png' */
  avatar?: string;
  /** 1-已离职；mock: 0 */
  leave?: number;
}

/**
 * 群组前 4 人信息
 * 注意：本接口字段名为 `id`（非域内共享类型的 `accountId`）
 */
export interface PersonalAiFrameImDialogueAccountInfo {
  /** 账号 id；mock: 'u@string("number", 6)' */
  id?: string;
  /** 昵称；mock: '@cname()' */
  nickName?: string;
  /** 头像；mock: 'https://cdn.example.com/u@string("number", 6).png' */
  avatar?: string;
}

/** 群组信息（type=3 时有值） */
export interface PersonalAiFrameImDialogueGroupInfo {
  /** 群类型；>=10 为外联群；mock: 1 */
  type?: number;
  /** 群归属企业 id；mock: 'c@string("number", 4)' */
  corpId?: string;
  /** 群组前 4 个人的信息 */
  accountInfoList?: PersonalAiFrameImDialogueAccountInfo[];
}

/** POST /personalAiFrame/getAllImDialogue 回参单项 */
export interface PersonalAiFrameImDialogueItem {
  /** 会话类型：1-私聊；3-群聊；mock: 1 */
  type?: PersonalAiFrameImDialogueType;
  /** 会话 id：群组 id 或私聊时对方的 id；mock: 't@string("number", 6)' */
  targetId?: string;
  /** 会话名称：群组名称或私聊时对方的姓名；mock: '@cname()' */
  targetName?: string;
  /** 当前会话用户是否已经选中（来自 ai_frame_user_setting）；mock: false */
  selected?: boolean;
  /** 最近活跃时间（毫秒）；mock: 1720000000000 */
  activeTime?: number;
  /** 群AI框智能体 ID，未创建时为 null；mock: '@string("lower", 18)' */
  agentId?: string | null;
  /** 群AI框智能体 AI 角色 ID，未创建时为 null；mock: '@string("lower", 18)' */
  aiRoleId?: string | null;
  /** 群AI框名称，未创建时为 null；mock: '群@ctitle()助手' */
  agentName?: string | null;
  /** 群AI框智能体头像 URL，未创建时为 null；mock: 'https://cdn.example.com/a@string("number", 6).png' */
  agentAvatar?: string | null;
  /** 私聊信息（type=1 时有值） */
  privateInfo?: PersonalAiFrameImDialoguePrivateInfo;
  /** 群组信息（type=3 时有值） */
  groupInfo?: PersonalAiFrameImDialogueGroupInfo;
}

/**
 * POST /personalAiFrame/getAllImDialogue 业务 data
 * 直接为会话数组（非 { items } 包裹）
 */
export type PersonalAiFrameGetAllImDialogueData = PersonalAiFrameImDialogueItem[];

/** POST /personalAiFrame/getAllImDialogue 完整回参 */
export type PersonalAiFrameGetAllImDialogueResp =
  ApiResponse<PersonalAiFrameGetAllImDialogueData>;
