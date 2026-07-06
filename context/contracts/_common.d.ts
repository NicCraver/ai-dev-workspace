/**
 * 全局通用约定
 * Changelog:
 * - 2026-07-06 初始化
 */

/** 所有接口的统一外层包裹 */
export interface ApiResponse<T> {
  code: number;   // 0 成功；非 0 见错误码表
  msg: string;
  data: T;
}

/** 错误码表（与后端对齐后维护在这里） */
export enum ErrorCode {
  OK = 0,
  UNAUTHORIZED = 401,
  // TODO: 与后端对齐
}
