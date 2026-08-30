import { useState } from "react";
import { View, Text, Textarea, Button, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  ragIndexDoc,
  ragAsk,
  ragListDocs,
  ragDeleteDoc,
  ragVerifyCorp,
} from "../../api/quiz";

export default function Kb() {
  const [corpInput, setCorpInput] = useState(""); // 门禁输入的企业码
  const [verified, setVerified] = useState(null); // 已验证通过的企业码（null=未进入知识库）
  const [verifying, setVerifying] = useState(false);
  const [mode, setMode] = useState("quiz"); // quiz=检索出题 | answer=知识问答
  const [query, setQuery] = useState("");
  const [nText, setNText] = useState("5");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [indexed, setIndexed] = useState(null); // 最近一次入库结果
  const [answer, setAnswer] = useState(""); // mode=answer 的回答
  const [sources, setSources] = useState([]);
  const [docs, setDocs] = useState(null); // 已入库文档列表（null=未加载）
  const [showDocs, setShowDocs] = useState(false);
  const [deleting, setDeleting] = useState(null); // 正在删除的文档名

  const loadDocs = async (code) => {
    try {
      const res = await ragListDocs(code);
      setDocs(res);
    } catch (e) {
      /* 错误已在请求层提示 */
    }
  };

  // 企业码门禁：只有输入对应企业码，才能进入知识库查看 / 管理界面
  const onEnter = async () => {
    const code = (corpInput || "").trim();
    if (!code) {
      Taro.showToast({ title: "请输入企业码", icon: "none" });
      return;
    }
    setVerifying(true);
    try {
      const res = await ragVerifyCorp(code);
      if (res.exists) {
        setVerified(code);
        setDocs(null);
        loadDocs(code);
        Taro.showToast({ title: `已进入「${code}」知识库`, icon: "none" });
        return;
      }
      // 该企业码下暂无知识库：默认拒绝进入，二次确认后才允许开通
      const confirm = await Taro.showModal({
        title: "企业码验证",
        content: `企业码「${code}」下暂无知识库。确认进入并开通吗？`,
        confirmText: "进入开通",
        confirmColor: "#e64340",
      });
      if (!confirm.confirm) return;
      setVerified(code);
      setDocs(null);
      loadDocs(code);
    } catch (e) {
      /* 错误已在请求层提示 */
    } finally {
      setVerifying(false);
    }
  };

  const onExit = () => {
    setVerified(null);
    setDocs(null);
    setIndexed(null);
    setAnswer("");
    setSources([]);
    setShowDocs(false);
  };

  // 进入知识库后，所有操作统一使用已验证的企业码
  const corpCode = verified;

  const onToggleDocs = () => {
    const next = !showDocs;
    setShowDocs(next);
    if (next) loadDocs(corpCode);
  };

  const onDeleteDoc = async (source) => {
    const confirm = await Taro.showModal({
      title: "删除文档",
      content: `确认删除《${source}》？删除后不可恢复，出题将不再引用该文档。`,
      confirmText: "删除",
      confirmColor: "#e64340",
    });
    if (!confirm.confirm) return;
    setDeleting(source);
    try {
      await ragDeleteDoc(corpCode, source);
      Taro.showToast({ title: `已删除《${source}》`, icon: "none" });
      loadDocs(corpCode);
      setIndexed((cur) => (cur && cur.filename === source ? null : cur));
    } catch (e) {
      /* 错误已在请求层提示 */
    } finally {
      setDeleting(null);
    }
  };

  const onPickFile = () => {
    if (process.env.TARO_ENV === "h5") {
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
          const res = await ragIndexDoc(file, corpCode);
          setIndexed(res);
          loadDocs(corpCode);
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
      return;
    }
    // 小程序：从微信会话中选择文件
    Taro.chooseMessageFile({
      count: 1,
      type: "all",
      extension: [".txt", ".md", ".doc", ".docx", ".pdf", ".wps", ".text"],
    })
      .then(async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        setUploading(true);
        try {
          const r = await ragIndexDoc(
            { path: file.path, name: file.name, size: file.size },
            corpCode
          );
          setIndexed(r);
          loadDocs(corpCode);
          Taro.showToast({
            title: `入库成功：${r.chunks} 块 / ${r.chars} 字`,
            icon: "none",
          });
        } catch (e) {
          /* 错误已在 ragIndexDoc 内提示 */
        } finally {
          setUploading(false);
        }
      })
      .catch(() => {
        /* 用户取消选择，忽略 */
      });
  };

  const onAsk = async () => {
    if (query.trim().length < 2) {
      Taro.showToast({ title: "问题至少 2 个字", icon: "none" });
      return;
    }
    const count = parseInt(nText, 10);
    if (!count || count < 1) {
      Taro.showToast({ title: "出题数量至少 1 题", icon: "none" });
      return;
    }
    setAsking(true);
    try {
      const res = await ragAsk({
        query,
        corp_code: corpCode,
        mode,
        n: count,
      });
      if (mode === "quiz") {
        // 补上 corp_code，便于答题页提交时带上企业码
        const payload = {
          task_id: res.task_id,
          corp_code: corpCode,
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

      {!verified ? (
        /* ---------- 企业码门禁：未验证，只能看到验证卡片 ---------- */
        <View className="card gate-card">
          <View className="gate-title">企业码验证</View>
          <Text className="muted">
            知识库按企业码严格隔离。请输入企业码，通过验证后才能查看 / 管理本企业知识库
          </Text>
          <View className="field" style={{ marginTop: 14 }}>
            <Text className="field-label">企业邀请码</Text>
            <Input
              className="field-input"
              placeholder="请输入企业码，如 Acme2026"
              value={corpInput}
              onInput={(e) => setCorpInput(e.detail.value)}
            />
          </View>
          <Button className="btn orange" disabled={verifying} onClick={onEnter}>
            {verifying ? "验证中…" : "进入知识库 →"}
          </Button>
        </View>
      ) : (
        /* ---------- 已验证：知识库查看 / 管理界面 ---------- */
        <View>
          <View className="corp-bar">
            <View className="corp-badge">企业码 · {corpCode}</View>
            <View className="btn ghost small" onClick={onExit}>
              切换企业码
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

          <View className="card" style={{ marginTop: 12 }}>
            <View
              className="src-title"
              onClick={onToggleDocs}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <Text>
                已入库文档{" "}
                {docs && (
                  <Text className="muted">
                    （{docs.documents.length} 篇 · {docs.total_chunks} 块）
                  </Text>
                )}
              </Text>
              <Text className="muted">{showDocs ? "▾" : "▸"}</Text>
            </View>
            {showDocs &&
              (docs === null ? (
                <Text className="muted" style={{ marginTop: 8 }}>
                  加载中…
                </Text>
              ) : docs.documents.length === 0 ? (
                <Text className="muted" style={{ marginTop: 8 }}>
                  暂无已入库文档，上传第一份文档即可完成开通
                </Text>
              ) : (
                docs.documents.map((d, i) => (
                  <View key={i} className="src-card" style={{ marginTop: 8 }}>
                    <View
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View className="src-title" style={{ flex: 1, marginRight: 8 }}>
                        {d.source}
                      </View>
                      <View
                        className={`btn-del${deleting === d.source ? " disabled" : ""}`}
                        onClick={() => onDeleteDoc(d.source)}
                      >
                        {deleting === d.source ? "删除中…" : "删除"}
                      </View>
                    </View>
                    <Text className="muted">
                      {d.chunks} 块 · {d.chars} 字
                    </Text>
                  </View>
                ))
              ))}
          </View>

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
                placeholder="如 5"
                value={nText}
                onInput={(e) => setNText(e.detail.value)}
                onBlur={() => {
                  const num = parseInt(nText, 10);
                  if (!num || num < 1) setNText("5");
                }}
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
        </View>
      )}

      <View className="foot">文档不出企业内网 · 001</View>
    </View>
  );
}
