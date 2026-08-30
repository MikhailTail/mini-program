import Taro from "@tarojs/taro";

/**
 * 云函数调用封装（微信小程序端）
 * 失败不抛错，返回 null，调用方自行降级
 */
export async function callCloud(name, data = {}) {
  if (!Taro.cloud) {
    console.warn("[cloud] 当前环境不支持云开发");
    return null;
  }
  try {
    const res = await Taro.cloud.callFunction({ name, data });
    const r = res && res.result;
    if (r && r.code === 0) return r.data;
    console.warn(`[cloud] ${name} 返回异常`, r);
    return null;
  } catch (e) {
    console.warn(`[cloud] ${name} 调用失败`, e);
    return null;
  }
}

/** 保存答题记录 + 报告到云数据库（静默，失败不影响主流程） */
export function saveAnswerRecord(payload) {
  return callCloud("saveAnswerRecord", payload);
}

/** 查询个人历史记录 */
export function getMyRecords(payload) {
  return callCloud("getMyRecords", payload);
}

/** 团队统计 */
export function getTeamStats(payload) {
  return callCloud("getTeamStats", payload);
}
