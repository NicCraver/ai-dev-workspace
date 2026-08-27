/**
 * 契约：智能会议室 · 预定生命周期
 * Changelog:
 * - 2026-08-27 改预定、周循环展开、我的历史、审计日志
 */

export type MeetingMineStatus = "ongoing" | "upcoming" | "ended" | "released";

export interface MeetingBookingWrite {
  roomId: string;
  date: string;
  start: string;
  end: string;
  title?: string;
  remark?: string | null;
  /** 仅当会议室 allowRecurring 时生效；按周展开到可提前天数内 */
  repeatWeekly?: boolean;
}

export interface MeetingBookingAudit {
  id: string;
  bookingId: string;
  seriesId: string | null;
  action: "create" | "update" | "release";
  actorUserId: string;
  actorUserName: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
