/**
 * 契约：智能会议室域 · 遥测批量上报
 * POST /meetingApi/events
 * Changelog:
 * - 2026-09-03 新增。看板 page_view / 手动预定 / 助手预定漏斗
 */

import type { ApiResponse } from '../_common'

export type MeetingTelemetryEventName =
  | 'page_view'
  | 'booking_open'
  | 'booking_submit'
  | 'booking_fail'
  | 'booking_release'
  | 'agent_chip'
  | 'agent_message'
  | 'agent_result'
  | 'agent_pick'
  | 'agent_confirm'
  | 'agent_back'
  | 'agent_booked'
  | 'agent_fail'

export interface MeetingTelemetryEvent {
  /** 前端 uuid，同一企业幂等 mock: '7c9e6679-7425-40de-944b-e07fc1f90ae7' */
  eventId: string
  eventName: MeetingTelemetryEventName
  /** ISO-8601 mock: '2026-09-03T10:00:00.000Z' */
  eventAt: string
  /** 页面路径 mock: '/' */
  page?: string
  /** 禁止带 text / message */
  props?: Record<string, unknown>
}

export interface MeetingTelemetryBatchReq {
  /** 最多 20 条 */
  events: MeetingTelemetryEvent[]
}

export interface MeetingTelemetryIngestData {
  accepted: number
  duplicated: number
}

export type MeetingTelemetryIngestRsp = ApiResponse<MeetingTelemetryIngestData>
