/**
 * 契约：智能会议室域 · 助手首屏快捷建议
 * GET /meetingApi/agent/suggestions
 * Changelog:
 * - 2026-08-27 新增：按上海时间和用户历史预订返回首屏快捷建议
 */

export interface MeetingAgentSuggestion {
  id: string;
  label: string;
  message: string;
  source: 'time' | 'history';
}

export type MeetingAgentSuggestionsData = MeetingAgentSuggestion[];
