import { useState } from "react";
import { View, Text, Textarea, Button, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ragIndexDoc, ragAsk } from "../../api/quiz";

export default function Kb() {
  const [corpCode, setCorpCode] = useState("default");
  const [mode, setMode] = useState("quiz"); // quiz=检索出题 | answer=知识问答
  const [query, setQuery] = useState("");
  const [n, setN] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [indexed, setIndexed] = useState(null); // 最近一次入库结果
  const [answer, setAnswer] = useState(""); // mode=answer 的回答
  const [sources, setSources] = useState([]);

  const onPickFile = () => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.id = "kb-file-input";
    input.accept = ".txt,.md,.doc,.docx,.pdf,.wps,.text";
    input.style.display = "none";
    // 必须挂到 DOM 上，H5 浏览器才允许触发文件选择
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      setUploading(true);
      try {
        const res = await ragIndexDoc(file, corpCode.trim() || "default");
        setIndexed(res);
        Taro.showToast({
          title: `入库成功：${res.chunks} 块 / ${res.chars} 字`,
          icon: "none",
        });
      } catch (e) {
        /* 错误已在 ragIndexDoc 内提示 */
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const onAsk = async () => {
    if (query.trim().length < 2) {
      Taro.showToast({ title: "问题至少 2 个字", icon: "none" });
      return;
    }
    setAsking(true);
    try {
      const res = await ragAsk({
        query,
        corp_code: corpCode.trim() || "default",
        mode,
        n,
      });
      if (mode === "quiz") {
        // 补上 corp_code，便于答题页提交时带上企业码
        const payload = {
          task_id: res.task_id,
          corp_code: corpCode.trim() || "default",
          questions: res.questions,
        };
        Taro.navigateTo({
          url: `/pages/quiz/index?data=${encodeURIComponent(JSON.stringify(payload))}`,
        });
      } else {
        setAnswer(res.answer || "");
        setSources(res.sources || []);
      }
    } catch (e) {
      /* 错误已在 request 统一提示 */
    } finally {
      setAsking(false);
    }
  };

  return (
    <View className="scr">
      <Text className="tag">知识库 / RAG</Text>
      <View className="title">企业知识库{`\n`}·精准出题</View>
      <View className="bubble">文档入库后，AI 只按库里的资料出题、答疑</View>

      <View className="field-row">
        <View className="field">
          <Text className="field-label">企业邀请码（隔离知识库）</Text>
          <Input
            className="field-input"
            placeholder="默认 default"
            value={corpCode}
            onInput={(e) => setCorpCode(e.detail.value)}
          />
        </View>
      </View>

      <Button className="btn orange" disabled={uploading} onClick={onPickFile}>
        {uploading ? "向量化入库中…" : "＋ 上传文档入库（PDF / MD / Word）"}
      </Button>
      {indexed && (
        <View className="card kb-ok">
          <Text>《{indexed.filename}》入库成功</Text>
          <Text className="muted">
            {indexed.chars} 字 · 切成 {indexed.chunks} 块 · 库内共 {indexed.total} 块
          </Text>
        </View>
      )}

      <View className="row-label">
        <Text className="tag small">提问 / 出题</Text>
      </View>

      <View className="mode-row">
        <View
          className={`mode${mode === "quiz" ? " on" : ""}`}
          onClick={() => setMode("quiz")}
        >
          <Text className="mode-n">A</Text>
          <Text>检索出题</Text>
        </View>
        <View
          className={`mode${mode === "answer" ? " on" : ""}`}
          onClick={() => setMode("answer")}
        >
          <Text className="mode-n">B</Text>
          <Text>知识问答</Text>
        </View>
      </View>

      {mode === "quiz" && (
        <View className="field" style={{ margin: "0 0 12px" }}>
          <Text className="field-label">出题数量</Text>
          <Input
            type="number"
            className="field-input"
            value={String(n)}
            onInput={(e) => setN(Number(e.detail.value) || 5)}
          />
        </View>
      )}

      <Textarea
        className="textarea"
        style={{ height: "140px" }}
        placeholder={
          mode === "quiz"
            ? "如：根据库里的考勤制度出 5 道题…"
            : "如：我们公司的带薪年假怎么算？"
        }
        value={query}
        onInput={(e) => setQuery(e.detail.value)}
      />

      <Button className="btn green" disabled={asking} onClick={onAsk}>
        {asking ? "检索生成中…" : mode === "quiz" ? "按资料出题 →" : "检索回答 →"}
      </Button>

      {answer && (
        <View className="answer-box">
          <View className="sec">
            <Text className="mark">答</Text>
            AI 回答
          </View>
          <View className="report-body">{answer}</View>
        </View>
      )}

      {sources.length > 0 && (
        <View>
          <View className="sec">
            <Text className="mark">据</Text>
            资料依据（来源）
          </View>
          {sources.map((s, i) => (
            <View key={i} className="card src-card">
              <View className="src-title">
                #{i + 1} · {s.source}
              </View>
              <View className="src-body">{s.content}</View>
            </View>
          ))}
        </View>
      )}

      <View className="foot">文档不出企业内网 · 001</View>
    </View>
  );
}
