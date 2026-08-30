/**
 * 云函数：saveAnswerRecord
 * 答题完成后，将判分结果与 AI 报告持久化到云数据库 answer_records 集合
 */
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const {
    task_id,
    device_id,
    corp_code,
    score,
    total,
    correct_count,
    results,
    report,
  } = event || {};

  if (!task_id || !device_id) {
    return { code: 400, msg: "参数不完整: task_id / device_id 必填" };
  }

  try {
    const addRes = await db.collection("answer_records").add({
      data: {
        openid: OPENID,
        task_id,
        device_id,
        corp_code: corp_code || "default",
        score: score ?? 0,
        total: total ?? 0,
        correct_count: correct_count ?? 0,
        results: Array.isArray(results) ? results : [],
        report: report || null,
        created_at: db.serverDate(),
      },
    });
    return { code: 0, data: { id: addRes._id } };
  } catch (e) {
    console.error("saveAnswerRecord failed:", e);
    return { code: 500, msg: e.message || "写入失败" };
  }
};
