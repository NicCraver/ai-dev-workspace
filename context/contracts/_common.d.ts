/**
 * 全局通用约定
 * Changelog:
 * - 2026-07-13 对齐实际后端外层：code 为 string（'M0000' 成功），补充 ctime / requestID
 * - 2026-07-06 初始化
 */

/** 所有接口的统一外层包裹（与 apps/web http 拦截器约定一致） */
export interface ApiResponse<T> {
  code: string; // 'M0000' 成功；其它见业务错误码
  msg: string;
  ctime?: number;
  requestID?: string;
  data: T;
}

/** 业务成功码 */
export const API_SUCCESS_CODE = 'M0000' as const;

/** 错误码表（与后端对齐后维护在这里） */
export enum ErrorCode {
  OK = 'M0000',
  // TODO: 与后端对齐其它业务码
}
