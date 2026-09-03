/**
 * 契约：个人AI框域 · 周工作数据范围选择四棵树
 * POST /corpPlateAccountRel/weekWorkDataRangeTree
 * Changelog:
 * - 2026-09-03 新增。一次返回 allTree / attentionTree / belongTree / manageTree，
 *   前端按 tab 取对应树渲染，不重复调接口。
 *   Jackson 序列化 boolean 时剥掉 is 前缀，JSON key 为 team / person（非 isTeam / isPerson）。
 *   enableState=1 的一级板块由前端拼接「XXX团队工作」节点（接口不返回该节点）。
 *   团队/人员个数 = 对应树里 team/person 节点数，前端直接数，后端不返计数。
 *   授权数据只在 allTree 出现，不进所属/关注。
 *   一级板块口径：非系统（systemPlate=0）+ 开启独立汇报（enableState=1）；
 *   未开启但下级有开启的上级会被团队树带出。
 */

import type { ApiResponse } from '../_common';

/** 树节点数据类型 */
export type PersonalAiFrameWeekWorkDataCode =
  | 'teamWork_plate'
  | 'teamWork_member';

/** 板块是否开启独立汇报：1-开启；0-关闭 */
export type PersonalAiFrameWeekWorkEnableState = 0 | 1;

/** 是否系统板块：1-是；0-不是；2-系统全员 */
export type PersonalAiFrameWeekWorkSystemPlate = 0 | 1 | 2;

/** POST /corpPlateAccountRel/weekWorkDataRangeTree 入参 */
export interface PersonalAiFrameWeekWorkDataRangeTreeReq {
  /** 当前登录账号 id；mock: '280' */
  accountId: string;
}

/** 人员信息（节点内 userInfo，头像来自 /account/selectFullPlatformAccount） */
export interface PersonalAiFrameWeekWorkDataRangeAccountInfo {
  /** 用户 accountId */
  id?: string;
  /** 昵称 */
  nickName?: string;
  /** 用户头像链接（来自 /account/selectFullPlatformAccount） */
  avatar?: string;
}

/**
 * 通用树节点（团队 / 子部门 / 人员）
 * attentionTree 平铺使用本类型；allTree/belongTree/manageTree 的子节点与 orphanUserList 也用本类型
 */
export interface PersonalAiFrameWeekWorkDataRangeTreeNode {
  /** 数据类型：teamWork_plate-板块；teamWork_member-团队成员 */
  dataCode?: PersonalAiFrameWeekWorkDataCode;
  /** 节点编码（同类型唯一、不变） */
  unitCode?: string;
  /** teamWork_plate 时为板块 id；teamWork_member 时为部门 id 或 accountId */
  id?: string;
  /** 节点名称 */
  title?: string;
  /** 节点简称 */
  shortTitle?: string;
  /** 企业 id（attentionTree 平铺无企业层，按此字段按需分组） */
  corpId?: string;
  /** 所属板块 id */
  plateId?: string;
  /**
   * 范围数 = 当前层级 + 下级所有（人 + 开启独立汇报的板块）
   * 全部 tab 计数用
   */
  countNumber?: number;
  /** 人数 = 该节点下所有成员数（含子级）；人员节点固定为 1 */
  peopleCount?: number;
  /** 板块是否开启独立汇报（1-开启 0-关闭）；人员节点无意义 */
  enableState?: PersonalAiFrameWeekWorkEnableState;
  /** 是否我关注的 */
  attention?: boolean;
  /** 是否我所属的 */
  belong?: boolean;
  /** 是否我主管的 */
  manage?: boolean;
  /** 是否其他授权给我的 */
  authorize?: boolean;
  /**
   * 是否是团队/板块/子部门节点（true=团队，false=人员）
   * 前端按它做团队/人员一级筛选；团队个数 = 本树 team===true 的节点数（后端不返计数）
   */
  team?: boolean;
  /**
   * 是否是人员节点（true=人员，false=团队）；与 team 互斥
   * 人员个数 = 本树 person===true 的节点数（后端不返计数）
   */
  person?: boolean;
  /** 人员信息（仅人员节点） */
  userInfo?: PersonalAiFrameWeekWorkDataRangeAccountInfo;
  /** 子节点（attentionTree 平铺，此字段应为空） */
  childUnitList?: PersonalAiFrameWeekWorkDataRangeTreeNode[];
}

/**
 * 一级板块节点
 * 口径：非系统板块（systemPlate=0）+ 开启独立汇报（enableState=1）；
 * 未开启但下级有开启的上级会被团队树带出。
 * enableState=1 时前端自行拼接「XXX团队工作」节点（接口不返回该节点）。
 */
export interface PersonalAiFrameWeekWorkDataRangePlateNode {
  /** 板块 id */
  plateId?: string;
  /** 板块名称 */
  plateName?: string;
  /** 企业 id */
  corpId?: string;
  /** 范围数 = 当前层级 + 下级所有（人 + 开启独立汇报的板块） */
  countNumber?: number;
  /** 人数 = 该板块下所有成员数（含子级） */
  peopleCount?: number;
  /** 是否开启独立汇报（1-开启 0-关闭）；前端据此决定是否拼接「XXX团队工作」节点 */
  enableState?: PersonalAiFrameWeekWorkEnableState;
  /** 是否系统板块（1-是 0-不是 2-系统全员） */
  systemPlate?: PersonalAiFrameWeekWorkSystemPlate;
  /** 排序 */
  sort?: number;
  /** 是否我关注的 */
  attention?: boolean;
  /** 是否我所属的 */
  belong?: boolean;
  /** 是否我主管的 */
  manage?: boolean;
  /** 是否其他授权给我的 */
  authorize?: boolean;
  /** 是否是团队/板块节点（固定 true，一级板块即团队类） */
  team?: boolean;
  /** 是否是人员节点（固定 false，板块不是人员） */
  person?: boolean;
  /** 板块下的团队、子部门、人员 */
  childUnitList?: PersonalAiFrameWeekWorkDataRangeTreeNode[];
}

/**
 * 企业节点
 * multiCorp=true 时 allTree/belongTree/manageTree 第一层是企业；
 * false 时前端不展示企业层，直接取 tree[0].corpPlateList 作为第一层。
 * attentionTree 平铺无企业层，不用本类型。
 */
export interface PersonalAiFrameWeekWorkDataRangeCorpNode {
  /** 企业 id */
  corpId?: string;
  /** 企业名 */
  corpName?: string;
  /** 企业简称 */
  corpShortName?: string;
  /**
   * 范围数 = 该企业下所有一级板块范围数之和 + 未归属板块的关注人员数
   */
  countNumber?: number;
  /**
   * 人数 = 该企业下所有一级板块人数之和 + 未归属板块的关注人员数
   */
  peopleCount?: number;
  /** 排序 */
  sort?: number;
  /** 是否我关注的 */
  attention?: boolean;
  /** 是否我所属的 */
  belong?: boolean;
  /** 是否我主管的 */
  manage?: boolean;
  /** 是否其他授权给我的 */
  authorize?: boolean;
  /** 该企业下的一级板块 */
  corpPlateList?: PersonalAiFrameWeekWorkDataRangePlateNode[];
  /** 关注的人员中未归属任何一级板块的（如跨企业关注的人） */
  orphanUserList?: PersonalAiFrameWeekWorkDataRangeTreeNode[];
}

/** POST /corpPlateAccountRel/weekWorkDataRangeTree 业务 data */
export interface PersonalAiFrameWeekWorkDataRangeTreeData {
  /**
   * 是否多企业
   * false 时前端不要把企业作为第一层渲染，直接取各 tree[0].corpPlateList（attentionTree 平铺无企业层）
   */
  multiCorp?: boolean;
  /**
   * 全部树：企业→一级板块→团队/子部门→人员
   * 合并所属/主管/授权/关注全部关系；授权数据只在全部树出现，不进所属/关注
   */
  allTree?: PersonalAiFrameWeekWorkDataRangeCorpNode[];
  /**
   * 关注树：平铺（关注的团队 + 关注的人员），无层级
   * 节点带 corpId 供前端按需分组；不含授权数据
   */
  attentionTree?: PersonalAiFrameWeekWorkDataRangeTreeNode[];
  /** 所属树：仅「我所属」关系的子树；不含授权数据 */
  belongTree?: PersonalAiFrameWeekWorkDataRangeCorpNode[];
  /** 主管树：仅「我主管」关系的子树 */
  manageTree?: PersonalAiFrameWeekWorkDataRangeCorpNode[];
}

/** POST /corpPlateAccountRel/weekWorkDataRangeTree 完整回参 */
export type PersonalAiFrameWeekWorkDataRangeTreeResp =
  ApiResponse<PersonalAiFrameWeekWorkDataRangeTreeData>;
