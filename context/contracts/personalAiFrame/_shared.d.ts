/**
 * 个人AI框域 · 多接口共享类型
 * Changelog:
 * - 2026-07-14 新增（群成员信息、附件、数据范围等）
 * - 2026-07-14 新增筛选类型 PersonalAiFrameFilterType / PersonalAiFrameFilterInfo（list / getFilter 共用）
 * - 2026-09-01 dataRangeType 补 5-周工作；新增周工作记忆类型 PersonalAiFrameWeekWork*
 * - 2026-07-16 dataRangeType 补齐 3-个人 / 4-分享；DataRangeScope 子项 scopeDataType/scopeDataId 改为必填（对齐 saveDataRange）
 * - 2026-07-16 附件 analysisStatus 补 3-没有得到分析（大小超限）（对齐 aiChat）
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
   * 0-得到了分析；1-没有得到分析（绿盾加密）；2-没有得到分析（格式错误）；3-没有得到分析（大小超限）
   */
  analysisStatus?: number;
}

/**
 * 智能体数据范围勾选项
 * dataRangeType：0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人；4-分享；5-周工作
 */
export interface PersonalAiFrameDataRangeChoose {
  /**
   * 智能体数据范围标记
   * 0-内置知识/维护的知识库；1-聊天记录-文本；2-聊天中的文件；3-个人；4-分享；5-周工作
   */
  dataRangeType?: number;
  /** 0-未选中；1-选中 */
  choose?: number;
}

/**
 * 周工作数据范围类型
 * 1-个人；2-板块；3-选中的部门（自动增减子级人员）；4-选中的部门（自动增减子级板块）
 */
export type PersonalAiFrameWeekWorkScopeDataType = 1 | 2 | 3 | 4;

/** 周工作选中的人/板块/部门 */
export interface PersonalAiFrameWeekWorkScope {
  /**
   * 1-个人；2-板块；3-选中的部门（自动增减子级人员）；4-选中的部门（自动增减子级板块）
   */
  scopeDataType: number;
  /** 个人=人员 id；板块=板块 id；3/4 选中的部门=板块 id */
  scopeDataId: string;
}

/** 周工作勾选全部：1-是；0-否 */
export type PersonalAiFrameWeekWorkSelectAllFlag = 0 | 1;

/**
 * 周工作记忆字段（知识范围 get/save、会话记忆、Agent 设置 aiParaInfo 共用）
 * showRangeTxt：get 回参与定时任务 save/publish 入参文档有列；saveDataRange 入参文档未列
 */
export interface PersonalAiFrameWeekWorkFields {
  /** 周工作选的数据范围（人 + 部门） */
  weekWorkScopeList?: PersonalAiFrameWeekWorkScope[];
  /** 周工作是否勾选了全部人：1-是；0-否 */
  weekWorkSelectAllAccount?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了全部板块：1-是；0-否 */
  weekWorkSelectAllPlate?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了关注中的全部人：1-是；0-否 */
  weekWorkSelectAllAttentionAccount?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了关注中的全部板块：1-是；0-否 */
  weekWorkSelectAllAttentionPlate?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了所属团队的全部人：1-是；0-否 */
  weekWorkSelectAllBelongTeamAccount?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了所属团队的全部板块：1-是；0-否 */
  weekWorkSelectAllBelongTeamPlate?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了主管团队的全部人：1-是；0-否 */
  weekWorkSelectAllManageTeamAccount?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 周工作是否勾选了主管团队的全部板块：1-是；0-否 */
  weekWorkSelectAllManageTeamPlate?: PersonalAiFrameWeekWorkSelectAllFlag;
  /** 全部数据展示文案，如「数据+XXX」；mock: '' */
  showRangeTxt?: string;
}

/** 智能体数据范围 scope（私聊/群聊对象） */
export interface PersonalAiFrameDataRangeScope {
  /** 智能体数据范围类型：1-私聊；3-群聊 */
  scopeDataType: number;
  /** 私聊=人员 id；群聊=群组 id */
  scopeDataId: string;
}

/** 引导问题 */
export interface PersonalAiFrameGuideQuestion {
  id?: string;
  content?: string;
}
