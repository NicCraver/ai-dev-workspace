/**
 * 契约：智能会议室域 · 助手一轮
 * POST /meetingApi/agent/turn
 * 分类：SSE 流式（非 axios 信封逐事件；HTTP 200 后 text/event-stream）
 * Changelog:
 * - 2026-08-27 新增。查空档 + 待确认预定；createBooking 仅 confirm 动作可写库
 */

import type {
  MeetingBookingDraft,
  MeetingBuddyExpression,
  MeetingFreeSlot
} from './_shared';

export type MeetingAgentAction = 'message' | 'pick_slot' | 'confirm' | 'cancel';

/** POST /meetingApi/agent/turn 入参。鉴权头与既有预定接口相同（token / corp / user）。 */
export interface MeetingAgentTurnReq {
  /** 会话 id；首轮可空，服务端在 session 事件里回填 mock: 'sess-uuid' */
  sessionId?: string;
  /**
   * 动作。省略或 message：用户自然语言。
   * pick_slot / confirm / cancel 不走 LLM。
   */
  action?: MeetingAgentAction;
  /** action=message 时必填 mock: '明天下午订一小时星海' */
  message?: string;
  /** action=pick_slot 时必填，必须是本轮 query/suggest 下发过的档 */
  slot?: MeetingFreeSlot;
  /** action=confirm 时必填 */
  draftId?: string;
  /** action=confirm 时可改主题，≤50 字 mock: '评审会' */
  title?: string;
}

export type MeetingAgentEvent =
  | MeetingAgentSessionEvent
  | MeetingAgentStatusEvent
  | MeetingAgentQueryEvent
  | MeetingAgentConfirmEvent
  | MeetingAgentSuggestEvent
  | MeetingAgentNeedMoreEvent
  | MeetingAgentErrorEvent
  | MeetingAgentBookedEvent
  | MeetingAgentClosedEvent;

export interface MeetingAgentSessionEvent {
  type: 'session';
  sessionId: string;
}

export interface MeetingAgentStatusEvent {
  type: 'status';
  /** 短状态，替换上一句，不当聊天记录 mock: '正在查空档' */
  text: string;
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentQueryEvent {
  type: 'query';
  /** 卡片标题 mock: '今天下午 · 空闲 ≥ 1 小时' */
  heading: string;
  /** 最多约 5 间；每间只带可点空档 */
  rooms: MeetingQueryRoom[];
  expression: MeetingBuddyExpression;
}

export interface MeetingQueryRoom {
  roomId: string;
  roomName: string;
  buildingName: string;
  floorName: string;
  capacity: number;
  facilities: string[];
  /** 用于迷你空闲条；busy 为已占用区间 */
  openStart: string;
  openEnd: string;
  busy: Array<{ start: string; end: string }>;
  /** 可点空档 */
  slots: MeetingFreeSlot[];
}

export interface MeetingAgentConfirmEvent {
  type: 'confirm';
  draft: MeetingBookingDraft;
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentSuggestEvent {
  type: 'suggest';
  /** mock: '该时段已被占用' */
  reason: string;
  /** 2～4 个完整档，点击后只进入 confirm，不直接写库 */
  options: MeetingFreeSlot[];
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentNeedMoreEvent {
  type: 'need_more';
  text: string;
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentErrorEvent {
  type: 'error';
  /** 展示给用户的句子，可与业务码 msg 一致 mock: '该时段已被占用' */
  msg: string;
  /** 业务码 mock: 'M4010' */
  code?: string;
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentBookedEvent {
  type: 'booked';
  /** 已写入的预定 id */
  bookingId: string;
  expression: MeetingBuddyExpression;
}

export interface MeetingAgentClosedEvent {
  type: 'closed';
  expression: MeetingBuddyExpression;
}

/**
 * SSE 每一帧：`data: ` + JSON.stringify(MeetingAgentEvent)
 * 流结束不再另包 ApiResponse。
 * 若在升级 SSE 前失败（未登录、缺配置）：普通 JSON ApiResponse，code ≠ M0000。
 */
