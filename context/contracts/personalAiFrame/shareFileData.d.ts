/**
 * 契约：个人AI框域 · 智能体分享知识库
 * POST /agentFileShare/shareFileData
 * @unconfirmed 后端状态：开发中
 * Changelog:
 * - 2026-07-14 新增 POST /agentFileShare/shareFileData
 */

import type { ApiResponse } from '../_common';

/** 分享目标类型：0-个人AI框；1-私聊；3-群聊 */
export type PersonalAiFrameShareToNodeType = 0 | 1 | 3;

/** 分享目标单项 */
export interface PersonalAiFrameShareFileDataTarget {
  /** 分享目标类型：1-私聊；3-群聊；0-个人AI框 */
  shareToNodeType?: PersonalAiFrameShareToNodeType;
  /** 分享目标节点 ID（个人 id 或群 id；个人 AI 框=智能体 id） */
  shareToNodeId?: string;
}

/** POST /agentFileShare/shareFileData 入参 */
export interface PersonalAiFrameShareFileDataReq {
  /** 操作人账号 id */
  accountId?: string;
  /** 智能体 id */
  agentId?: string;
  /** 编辑的智能体版本 id */
  agentVersionId?: string;
  /** 分享目标列表 */
  shareFileDataList?: PersonalAiFrameShareFileDataTarget[];
}

/** POST /agentFileShare/shareFileData 完整回参（data 为 null） */
export type PersonalAiFrameShareFileDataResp = ApiResponse<null>;
