import { useState } from "react";
import { View, Text, Textarea, Button, Image } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { submitQuiz, getDeviceId } from "../../api/quiz";

const TYPE_LABEL = { single: "单选", multiple: "多选", judge: "判断", blank: "填空", short: "简答" };
const TYPE_CLASS = { single: "single", multiple: "multiple", judge: "judge", blank: "blank", short: "short" };

const QUIPS = {
  single: "单选题，眼一闭一睁就选完了 👀",
  multiple: "多选像点菜，少点漏点都白搭 🤡",
  judge: "判断题，对就是对、错就是错（废话）",
  blank: "填空题，憋不出来就划水",
  short: "简答题，字多=分多，冲！",
};

export default function Quiz() {
  const router = useRouter();
  const task = JSON.parse(decodeURIComponent(router.params.data || "{}"));
  const questions = task.questions || [];

  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const q = questions[idx];
  if (!q) return <View className="scr"><Text>无题目</Text></View>;

  const isMultiple = q.q_type === "multiple";
  const isText = q.q_type === "blank" || q.q_type === "short";
  const sel = answers[idx] || (isMultiple ? [] : "");

  const toggle = (key) => {
    if (isMultiple) {
      // 答案以字符串存储（如 "AB"），从已存串解析出当前已选 key 列表
      const curStr = typeof sel === "string" ? sel : Array.isArray(sel) ? sel.join("") : "";
      const cur = curStr.split("");
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      setAnswers({ ...answers, [idx]: next.sort().join("") });
    } else {
      setAnswers({ ...answers, [idx]: key });
    }
  };

  const onBlank = (v) => setAnswers({ ...answers, [idx]: v });

  const isSelected = (key) => (isMultiple ? (sel || "").includes(key) : sel === key);

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else finish();
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      const payload = {
        task_id: task.task_id,
        device_id: getDeviceId(),
        corp_code: task.corp_code,
        answers: questions.map((qq, i) => ({
          q_type: qq.q_type,
          user_answer: answers[i] || "",
          correct_answer: qq.answer,
          point: qq.point,
          analysis: qq.analysis,
        })),
      };
      const res = await submitQuiz(payload);
      Taro.redirectTo({
        url: `/pages/report/index?data=${encodeURIComponent(JSON.stringify(res))}`,
      });
    } catch (e) {
      setSubmitting(false);
    }
  };

  const starCount = Math.max(1, Math.round(((idx + 1) / questions.length) * 5));

  return (
    <View className="scr">
      <Text className="tag">答题闯关 · Q{idx + 1}/{questions.length}</Text>
      <View className="stars">{`★`.repeat(starCount)}{`☆`.repeat(5 - starCount)}</View>

      <View className="qbox">
        <Text className="title" style={{ fontSize: "32px", margin: "0 0 10px" }}>
          {q.content}
        </Text>
        {q.image && (
          <Image
            src={q.image}
            mode="widthFix"
            style={{ width: "100%", borderRadius: "12px", marginBottom: "10px" }}
          />
        )}
        <Text className={`qtype ${TYPE_CLASS[q.q_type]}`}>{TYPE_LABEL[q.q_type]}</Text>
        {isMultiple && <Text className="qtip">⚠ 多选：可勾多个，少一个都扣分</Text>}
      </View>

      <View className="bubble">{QUIPS[q.q_type] || "加油，奥利给！"}</View>

      {/* 选择题 / 判断题：选项 */}
      {q.q_type !== "blank" && q.q_type !== "short" && q.options && (
        <View>
          {q.options.map((o) => {
            const on = isSelected(o.key);
            return (
              <View
                key={o.key}
                className={`opt${on ? " on" : ""}${isMultiple ? " multi" : ""}`}
                onClick={() => toggle(o.key)}
              >
                <View className="key">{on ? (isMultiple ? "✓" : o.key) : o.key}</View>
                <Text>{o.text}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 判断题无 options：提供 正确/错误 两个选项 */}
      {q.q_type === "judge" && (
        <View>
          {["正确", "错误"].map((t) => {
            const on = sel === t;
            return (
              <View
                key={t}
                className={`opt${on ? " on" : ""}`}
                onClick={() => toggle(t)}
              >
                <View className="key">{on ? "✓" : ""}</View>
                <Text>{t}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 填空 / 简答 */}
      {isText && (
        <Textarea
          className="textarea"
          style={{ height: q.q_type === "blank" ? "140px" : "220px" }}
          placeholder={q.q_type === "blank" ? "填写答案…" : "简要作答…"}
          value={isMultiple ? "" : sel}
          onInput={(e) => onBlank(e.detail.value)}
        />
      )}

      <Button className="btn orange" loading={submitting} disabled={submitting} onClick={next}>
        {idx < questions.length - 1 ? "下一题 →" : "提交并看报告 🎉"}
      </Button>
      <View className="foot">圆圈=单选 · 方块=多选</View>
    </View>
  );
}
