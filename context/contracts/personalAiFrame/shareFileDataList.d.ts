/**
 * 契约：个人AI框域 · 分享的智能体列表
 * POST /agentFileShare/shareFileDataList
 * @unconfirmed 后端状态：开发中
 * Changelog:
 * - 2026-07-14 新增 POST /agentFileShare/shareFileDataList
 */

import type { ApiResponse } from '../_common';
import type { PersonalAiFrameShareToNodeType } from './shareFileData';

/** 排序字段：1-名称；2-时间 */
export type PersonalAiFrameShareOrderByType = 1 | 2;

/** 排序方向：1-正序；2-倒序 */
export type PersonalAiFrameShareSortType = 1 | 2;

/** 分享记录状态：1-已分享待发布；2-已取消待发布；3-已发布 */
export type PersonalAiFrameShareStatus = 1 | 2 | 3;

/** 创建人信息 */
export interface PersonalAiFrameShareCreateAccountInfo {
  accountId?: string;
  nickName?: string;
  avatar?: string;
}

/** 分享记录单项 */
export interface PersonalAiFrameShareFileDataListItem {
  /** 主键 ID */
  id?: string;
  /** 分享来自智能体 id */
  shareFromAgentId?: string;
  /** 分享来自的通道 id（规则与 aiAgent 一致） */
  shareFromChannelId?: string;
  /** 分享目标类型：1-私聊；3-群聊；0-个人AI框 */
  shareToNodeType?: PersonalAiFrameShareToNodeType;
  /** 分享目标节点 ID（个人 id 或群 id；个人智能体 id） */
  shareToNodeId?: string;
  /** 分享给的通道 id（规则与 aiAgent 一致） */
  shareToChannelId?: string;
  /** 启用状态：1-启用；0-禁用 */
  enableState?: number;
  creator?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  createAt?: string;
  updator?: string;
  /** 格式 yyyy-MM-dd HH:mm:ss */
  updateAt?: string;
  /** 是否删除：1-删除；0-正常 */
  isDel?: number;
  createAccountInfo?: PersonalAiFrameShareCreateAccountInfo;
  /** 分享到的人名或群名 */
  shareToName?: string;
  /** 状态：1-已分享待发布；2-已取消待发布；3-已发布 */
  status?: PersonalAiFrameShareStatus;
  /** 分享来自的智能体版本 id */
  shareFromAgentVersionId?: string;
}

/** POST /agentFileShare/shareFileDataList 入参 */
export interface PersonalAiFrameShareFileDataListReq {
  /** 操作人账号 id */
  accountId: string;
  /** 智能体 id */
  agentId: string;
  /** 编辑的智能体版本 id */
  agentVersionId: string;
  /** 排序字段：1-名称；2-时间 */
  orderByType: PersonalAiFrameShareOrderByType;
  /** 正序倒序：1-正序；2-倒序 */
  sortType: PersonalAiFrameShareSortType;
}

/** POST /agentFileShare/shareFileDataList 完整回参 */
export type PersonalAiFrameShareFileDataListResp = ApiResponse<
  PersonalAiFrameShareFileDataListItem[]
>;
