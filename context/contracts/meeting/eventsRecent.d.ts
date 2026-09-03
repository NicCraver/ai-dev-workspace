/**
 * 契约：智能会议室域 · 最近遥测（管理员联调）
 * GET /meetingApi/events/recent
 * Changelog:
 * - 2026-09-03 新增。本企业最近 N 条，需管理员
 */

import type { ApiResponse } from '../_common'
import type { MeetingTelemetryEventName } from './events'

export interface MeetingTelemetryRecentItem {
  eventId: string
  eventName: MeetingTelemetryEventName
  eventAt: string
  userId: string
  clientType: string
  page?: string
  /** JSON 字符串 */
  props?: string
}

export type MeetingTelemetryRecentRsp = ApiResponse<MeetingTelemetryRecentItem[]>
