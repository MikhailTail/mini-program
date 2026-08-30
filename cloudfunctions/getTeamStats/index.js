/**
 * 云函数：getTeamStats
 * 按企业邀请码 corp_code 聚合团队答题统计（参与人次/平均分/薄弱知识点 Top）
 */
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { corp_code = "default" } = event || {};

  try {
    // 聚合最多读取 1000 条，按需可配合聚合 pipeline 优化
    const res = await db
      .collection("answer_records")
      .where({ corp_code })
      .limit(1000)
      .get();
    const list = res.data || [];
    const total = list.length;
    if (!total) {
      return { code: 0, data: { total: 0, participants: 0, avgScore: 0, weakPoints: [] } };
    }

    const sumScore = list.reduce((s, r) => s + (Number(r.score) || 0), 0);
    const participants = new Set(list.map((r) => r.device_id)).size;

    const weakMap = {};
    list.forEach((r) => {
      const wp = r.report && Array.isArray(r.report.weak_points) ? r.report.weak_points : [];
      wp.forEach((w) => {
        if (w) weakMap[w] = (weakMap[w] || 0) + 1;
      });
    });
    const weakPoints = Object.entries(weakMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([point, count]) => ({ point, count }));

    return {
      code: 0,
      data: {
        total,
        participants,
        avgScore: Math.round(sumScore / total),
        weakPoints,
      },
    };
  } catch (e) {
    console.error("getTeamStats failed:", e);
    return { code: 500, msg: e.message || "统计失败" };
  }
};
