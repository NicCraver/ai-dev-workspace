/**
 * 契约：智能会议室 · 预定生命周期
 * Changelog:
 * - 2026-09-04 前端暂移除周期预定；`repeatWeekly` 保留字段但不再使用
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
  /** @deprecated 前端已移除周期预定入口，暂勿传 */
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
