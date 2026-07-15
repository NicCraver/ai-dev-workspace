/**
 * 个人AI框域 · 多接口共享类型
 * Changelog:
 * - 2026-07-14 新增（群成员信息、附件、数据范围等）
 * - 2026-07-14 新增筛选类型 PersonalAiFrameFilterType / PersonalAiFrameFilterInfo（list / getFilter 共用）
 */

/** 筛选类型（多选）：1-近15天问答的 AI 框；2-有知识库的 AI 框（个人 AI 框不受影响） */
export type PersonalAiFrameFilterType = 1 | 2;

/** 筛选勾选态（回传当前生效的筛选 UI 状态） */
export interface PersonalAiFrameFilterInfo {
  /** 个人AI框是否勾选（始终 true，不可取消）；mock: true */
  personalChecked?: boolean;
  /**
   * 当前生效的筛选类型（多选）
   * 1-近15天问答；2-有知识库
   * 前端用 contains 判断 recentChatChecked / hasKnowledgeChecked；无记录时为空数组
   */
  filterTypes?: PersonalAiFrameFilterType[];
}

/** 群成员信息（前端用 avatar 拼 4 宫格群头像：群主 + 3 成员） */
export interface PersonalAiFrameAccountInfo {
  /** mock: 'u@string("number", 6)' */
  accountId?: string;
  /** mock: '@cname()' */
  nickName?: string;
  /** mock: 'https://cdn.example.com/u@string("number", 6).png' */
  avatar?: string;
}

/** 附件 */
export interface PersonalAiFrameAttachment {
  /** 附件链接 */
  url?: string;
  /** 附件名称 */
  name?: string;
  /** 附件大小（字节） */
  fileSize?: number;
  /** 附件详细类型，如 jpg、doc */
  fileType?: string;
  /**
   * 附件是否得到 AI 分析
   * 0-得到了分析；1-没有得到分析（绿盾加密）；2-没有得到分析（格式错误）
   */
  analysisStatus?: number;
}

/**
 * 智能体数据范围勾选项
 * 0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件
 * 扩展：3-个人知识；4-共享知识（agentSetDataRangeExpand / getLastSessionMessage 回参）
 */
export interface PersonalAiFrameDataRangeChoose {
  dataRangeType?: number;
  /** 0-未选中；1-选中 */
  choose?: number;
}

/** 智能体数据范围 scope（私聊/群聊对象） */
export interface PersonalAiFrameDataRangeScope {
  /** 1-私聊；3-群聊 */
  scopeDataType?: number;
  /** 私聊=人员 id；群聊=群组 id */
  scopeDataId?: string;
}

/** 引导问题 */
export interface PersonalAiFrameGuideQuestion {
  id?: string;
  content?: string;
}
