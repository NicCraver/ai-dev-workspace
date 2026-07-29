/**
 * 契约：群详情 · 群机器人（本功能消费片段）
 * POST /api/chat/v1/group/get（分类：群组相关）
 *
 * 可 @ 判定（客户端本地）：
 *   canAtRobot = String(chatRobotType) !== "1" || String(hasCallBackAddress) === "1"
 * - chatRobotType 为 1：仅 hasCallBackAddress 为 1 时可 @
 * - chatRobotType 不为 1（含缺省）：均可 @
 *
 * Changelog:
 * - 2026-07-29 新增消费方：ios/安卓「群机器人可 @ 判定」；登记 hasCallBackAddress
 * - 2026-07-29 初稿（groupRobots 片段）
 */

import type { ApiResponse } from '../_common';

/** POST /group/get 入参（与 groupGet.groupAgentRels 同接口） */
export interface GroupGetReq {
  /** 群 id；必填 */
  id: string;
  /** 当前账号 id；可选 */
  accountId?: string;
  /** 类型；可选 */
  type?: number;
  /** 版本；可选 */
  version?: string;
}

/**
 * 群机器人单项（data.groupRobots[]）
 * - `@` 候选人 / 消息「@回复」：按 canAtRobot 判定是否可 @
 * - 群设置「群机器人」列表：展示全部，不过滤
 */
export interface GroupRobotInfo {
  /** 机器人融云账号 id（robot_ 前缀）；必填；mock: 'robot_123' */
  chatAccountId: string;
  /** 名称；mock: '值班助手' */
  chatRobotName?: string;
  /** 头像 URL */
  chatRobotImage?: string;
  /** 机器人状态：-1 解绑，1 正常；mock: '1' */
  chatRobotState?: string | number;
  /**
   * 机器人类型。
   * - 为 1：须 hasCallBackAddress===1 才可 @
   * - 不为 1（含缺省）：均可 @
   * mock: '1'
   */
  chatRobotType?: string | number;
  /**
   * 是否有回调地址。1 = 有。
   * 仅 chatRobotType===1 时参与可 @ 判定；比较时转字符串。
   * mock: 1
   */
  hasCallBackAddress?: string | number;
  chatRobotCorpId?: string;
  chatRobotCreator?: string;
  chatRobotDetail?: string;
  chatRobotIp?: string;
  chatRobotKeyWord?: string;
  chatRobotSecret?: string;
  serviceAddress?: string;
  webHookUrl?: string;
}

/**
 * group/get 回参中与群机器人相关的片段
 */
export interface GroupGetRobotsSlice {
  /** 群内机器人列表 */
  groupRobots?: GroupRobotInfo[];
}

/** POST /group/get — 本功能只消费群机器人相关字段 */
export type GroupGetRobotsRes = ApiResponse<GroupGetRobotsSlice>;
