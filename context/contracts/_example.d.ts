/**
 * 契约示例：语音消息域
 * Changelog:
 * - 2026-07-06 初始化（mock 阶段，未与后端确认字段以 @unconfirmed 标注）
 */

/** GET /api/v1/voice/messages 分页拉取语音消息列表 */
export interface VoiceMessageListReq {
  conversationId: string;
  cursor?: string;       // 上一页返回的游标；首页不传
  pageSize?: number;     // 默认 20，最大 50
}

export interface VoiceMessage {
  id: string;
  senderId: string;
  url: string;           // 音频文件地址，有效期 1h，过期需重新拉取
  durationMs: number;
  /** @unconfirmed 后端未确认是否返回波形数据 */
  waveform?: number[];
  createdAt: string;     // ISO 8601
}

export interface VoiceMessageListResp {
  list: VoiceMessage[];
  nextCursor: string | null;  // null 表示没有更多
}
