/**
 * 云函数：getMyRecords
 * 按 device_id 查询个人历史答题记录（倒序分页）
 */
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { device_id, page = 1, pageSize = 20 } = event || {};

  if (!device_id) {
    return { code: 400, msg: "缺少 device_id" };
  }

  try {
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
    const pg = Math.max(Number(page) || 1, 1);
    const res = await db
      .collection("answer_records")
      .where({ device_id, openid: OPENID })
      .orderBy("created_at", "desc")
      .skip((pg - 1) * size)
      .limit(size)
      .get();
    return { code: 0, data: res.data };
  } catch (e) {
    console.error("getMyRecords failed:", e);
    return { code: 500, msg: e.message || "查询失败" };
  }
};
