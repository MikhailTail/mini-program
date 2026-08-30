import { useState } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { generateReport, getDeviceId } from "../../api/quiz";
import { saveAnswerRecord } from "../../utils/cloud";

function gradeOf(score) {
  if (score >= 90) return "优秀 · 稳得很，小心被打！";
  if (score >= 75) return "良好 · 继续冲高！";
  if (score >= 60) return "及格边缘 · 再练练更保险";
  return "挂科边缘 · 回去翻资料！";
}

export default function Report() {
  const router = useRouter();
  const submit = JSON.parse(decodeURIComponent(router.params.data || "{}"));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // 红笔打分统一按“每题 10 分”重算：分数 = 答对题数 × 10，与下方“满分 N 分·答对 M 题”保持一致
  const realScore = (submit.correct_count || 0) * 10;
  const pass = realScore >= 60;

  const gen = async () => {
    setLoading(true);
    try {
      const res = await generateReport({
        task_id: submit.task_id,
        device_id: getDeviceId(),
        corp_code: submit.corp_code,
        score: realScore,
        total: submit.total,
        correct_count: submit.correct_count,
        results: submit.results,
      });
      setReport(res);
      // 静默留存答题记录+报告到云数据库（云开发）
      saveAnswerRecord({
        task_id: submit.task_id,
        device_id: getDeviceId(),
        corp_code: submit.corp_code,
        score: realScore,
        total: submit.total,
        correct_count: submit.correct_count,
        results: submit.results,
        report: {
          summary: res.summary,
          weak_points: res.weak_points,
          suggestions: res.suggestions,
          degraded: res.degraded,
        },
      });
    } catch (e) {
      // toast in request
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="scr">
      <Text className="tag">AI 分析报告</Text>
      <View className="title">成绩单（红笔打分）</View>

      <View className={`score${pass ? " pass" : ""}`}>{realScore}</View>
      <View className="score-label">满分 {submit.total * 10} 分 · 答对 {submit.correct_count}/{submit.total} 题</View>
      <View className="grade-line">
        评级：<b>{gradeOf(realScore)}</b>
        {report && report.degraded ? "（报告为本地降级）" : ""}
      </View>

      <View className="bubble">{pass ? "老板问你学会了没，亮这份 😎" : "没事，阿衰也常挂科，翻翻资料再来 💪"}</View>

      {!report ? (
        <Button className="btn green" loading={loading} disabled={loading} onClick={gen}>
          {loading ? "AI 复盘报告中…" : "生成 AI 复盘报告 →"}
        </Button>
      ) : (
        <View>
          <View className="sec"><Text className="mark">✎</Text>总体评价</View>
          <View className="report-body">{report.summary}</View>

          <View className="sec"><Text className="mark">✗</Text>薄弱知识点</View>
          <View className="weak">
            {report.weak_points.map((w, i) => (
              <Text key={i} className="w">{w}</Text>
            ))}
          </View>

          <View className="sec"><Text className="mark">✎</Text>学习建议</View>
          {report.suggestions.map((s, i) => (
            <View key={i} className="sug">· {s}</View>
          ))}
        </View>
      )}

      <Button className="btn" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
        再来一份资料 ↺
      </Button>
      <View className="foot">钉在课桌上的草稿纸 · 003</View>
    </View>
  );
}
