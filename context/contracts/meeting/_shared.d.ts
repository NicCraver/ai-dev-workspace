/**
 * 契约：智能会议室域 · 共享类型
 * Changelog:
 * - 2026-08-27 助手 agent 初版：空档、草稿、表情
 */

/** 30 分钟对齐的空闲档，点选后必须原样进入待确认草稿 */
export interface MeetingFreeSlot {
  /** 会议室 id mock: 'room-1' */
  roomId: string;
  /** 会议室名称 mock: '星海' */
  roomName: string;
  /** 建筑 mock: 'A座' */
  buildingName: string;
  /** 楼层 mock: '3F' */
  floorName: string;
  /** 容量 mock: 12 */
  capacity: number;
  /** 设施 mock: ['投影'] */
  facilities: string[];
  /** 日期 yyyy-MM-dd mock: '2026-08-27' */
  date: string;
  /** 开始 HH:mm，30 分钟对齐 mock: '14:00' */
  start: string;
  /** 结束 HH:mm，30 分钟对齐 mock: '15:00' */
  end: string;
}

/** 服务端签发的待确认草稿；过期或换用户后作废 */
export interface MeetingBookingDraft {
  /** 草稿 id mock: 'draft-uuid' */
  draftId: string;
  slot: MeetingFreeSlot;
  /** 会议主题，空则落库为「无主题会议」 mock: '周会' */
  title: string;
}

/** 助手 bot 表情，驱动 SVG 眼形，不单独下发图片 */
export type MeetingBuddyExpression =
  | 'idle'
  | 'focus'
  | 'ease'
  | 'expect'
  | 'sorry'
  | 'puzzled'
  | 'happy'
  | 'down';
