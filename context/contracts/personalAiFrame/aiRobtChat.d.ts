/**
 * 契约：智信AI框-会话 · AT智能体
 * POST /v1/aiRobtChat
 * 分类：智信AI框-会话 · AT智能体
 * 维护人：苑立杰
 * Changelog:
 * - 2026-07-28 新增 POST /v1/aiRobtChat（对齐后端文档）；路径拼写为 aiRobtChat（后端原样）；
 *   入参含 dataRangeScopeList / agentId；响应 data 为空对象；
 *   PC 现网 timeType / netSearch / deepThink 传 string；msgUID 在 IM 发送成功后回填
 * - 2026-07-28 后端确认：agentId 群智能体与个人 AI 均必传；aiRoleId 两边仍传 '1'
 *   （后端靠 agentId 判定智能体身份）；dataRangeScopeList 仅个人 AI 带
 */

import type { ApiResponse } from '../_common';
import type {
  PersonalAiFrameDataRangeChoose,
  PersonalAiFrameDataRangeScope,
} from './_shared';

/**
 * chooseList 单项：通用查询类型（im 会话）
 * type：1-私聊；3-群聊
 */
export interface PersonalAiFrameAiRobtChatChooseItem {
  /** im：会话 id */
  id?: string;
  /** im：会话类型，1-私聊；3-群聊 */
  type?: string | number;
  /** im：会话名称 */
  name?: string;
}

/** POST /v1/aiRobtChat 入参（亦作 IM extendData.agentChatData 载荷） */
export interface PersonalAiFrameAiRobtChatReq {
  /** 当前登录人 id；mock: '280' */
  accountId: string;
  /** 操作人名称；mock: '张三' */
  nickName: string;
  /** ai 框角色 id；群与个人 AI 均固定传 '1'，智能体身份由 agentId 判定 */
  aiRoleId: string;
  /** 企业 id */
  corpId: string;
  /** 向 AI 框提问的文本内容 */
  content: string;
  /** 群组 id */
  groupId: string;
  /**
   * 当前发送的消息 id
   * 现网：IM 发送成功后由 messageUId 回填，再调本接口
   */
  msgUID: string;
  /** 被回复消息的 uuid；无回复则无值 / 空串 */
  referUuid?: string;
  /**
   * 智能体数据范围
   * 单项 dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件
   * （与 saveDataRange 共用类型时还可含 3-个人 / 4-分享）
   * 单项 choose：0-未选中；1-选中
   * @note 后端文档标 string；与域内其它契约统一用 number，联调若需 string 再改
   */
  dataRangeList?: PersonalAiFrameDataRangeChoose[];
  /** 时间类型（一定有值）；PC 现网传 string，如 '7' */
  timeType: string;
  /** 通用参数-查询类型（im 会话列表） */
  chooseList?: PersonalAiFrameAiRobtChatChooseItem[];
  /** 联网搜索：0-未开启；1-开启；PC 现网传 string */
  netSearch: string;
  /** 深度思考：0-未开启；1-开启；PC 现网传 string */
  deepThink: string;
  /**
   * 数据范围（人和群）
   * 子项必填：scopeDataType（1-私聊；3-群聊）、scopeDataId（私聊=人员 id；群聊=群组 id）
   * 个人 AI @ 发送时需带；群智能体路径现网可不传
   */
  dataRangeScopeList?: PersonalAiFrameDataRangeScope[];
  /**
   * 智能体 id（必传）
   * - 个人 AI：groupAgentRels[].agentId
   * - 群智能体：getAgentDataRange 回参顶层 agentId（PC 现网存于 chat-box.agentMemoryAgentId）
   * - 现网 PC 尚未传，本期两条路径都要补
   */
  agentId: string;
  /**
   * @unconfirmed 后端文档未列；PC messageService 在发送成功后会附带 objectName
   */
  objName?: string;
}

/** POST /v1/aiRobtChat 业务 data（成功时无业务字段） */
export interface PersonalAiFrameAiRobtChatData {}

/** POST /v1/aiRobtChat 完整回参 */
export type PersonalAiFrameAiRobtChatResp =
  ApiResponse<PersonalAiFrameAiRobtChatData>;
