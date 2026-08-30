import { useState } from "react";
import { View, Text, Textarea, Button, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { generateQuiz, uploadDoc } from "../../api/quiz";

export default function Index() {
  const [content, setContent] = useState("");
  const [nText, setNText] = useState("5");
  const [corpCode, setCorpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputShow, setInputShow] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);

  const onGenerate = async () => {
    if (content.trim().length < 10) {
      Taro.showToast({ title: "资料至少 10 个字", icon: "none" });
      setInputShow(true);
      return;
    }
    const count = parseInt(nText, 10);
    if (!count || count < 1) {
      Taro.showToast({ title: "出题数量至少 1 题", icon: "none" });
      return;
    }
    setLoading(true);
    try {
      const res = await generateQuiz(content, count, corpCode || null);
      Taro.navigateTo({
        url: `/pages/quiz/index?data=${encodeURIComponent(JSON.stringify(res))}`,
      });
    } catch (e) {
      /* 错误已在 request 统一提示 */
    } finally {
      setLoading(false);
    }
  };

  const onPickFile = () => {
    if (process.env.TARO_ENV === "h5") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt,.md,.doc,.docx,.pdf,.wps,.text,.jpg,.jpeg,.png,.bmp,.webp";
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        setUploading(true);
        try {
          const res = await uploadDoc(file);
          setContent(res.text);
          setUploadInfo({
            filename: res.filename,
            chars: res.chars,
            truncated: res.truncated,
            preview: (res.text || "").slice(0, 200),
          });
          Taro.showToast({
            title: `已载入 ${res.chars} 字（${res.filename}）${res.truncated ? "，超长已截取" : ""}`,
            icon: "none",
          });
          setInputShow(true);
        } catch (e) {
          /* 错误已在 uploadDoc 内提示 */
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
      extension: [
        ".txt",
        ".md",
        ".doc",
        ".docx",
        ".pdf",
        ".wps",
        ".text",
        ".jpg",
        ".jpeg",
        ".png",
        ".bmp",
        ".webp",
      ],
    }).then(async (res) => {
      const file = res.tempFiles && res.tempFiles[0];
      if (!file) return;
      setUploading(true);
      try {
        const r = await uploadDoc({ path: file.path, name: file.name, size: file.size });
        setContent(r.text);
        setUploadInfo({
          filename: r.filename,
          chars: r.chars,
          truncated: r.truncated,
          preview: (r.text || "").slice(0, 200),
        });
        Taro.showToast({
          title: `已载入 ${r.chars} 字（${r.filename}）${r.truncated ? "，超长已截取" : ""}`,
          icon: "none",
        });
        setInputShow(true);
      } catch (e) {
        /* 错误已在 uploadDoc 内提示 */
      } finally {
        setUploading(false);
      }
    }).catch(() => {
      /* 用户取消选择，忽略 */
    });
  };

  return (
    <View className="scr">
      <Text className="tag">首页 / 企业资料</Text>
      <View className="title">AI闯关答题{`\n`}·企业版</View>
      <View className="bubble">今天也来被题拷打一下？</View>

      <Button
        className="btn ghost small"
        onClick={() => Taro.navigateTo({ url: "/pages/kb/index" })}
      >
        ＋ 企业知识库（RAG 精准出题）
      </Button>

      {!inputShow ? (
        <Button className="btn red" onClick={() => setInputShow(true)}>
          ＋ 粘贴资料 / 上传文档
        </Button>
      ) : (
        <View>
          <View className="row-label">
            <Text className="tag small">资料内容</Text>
            <Text className="muted">粘贴制度 / 培训笔记…</Text>
          </View>
          <Textarea
            className="textarea"
            focus
            maxlength={100000}
            placeholder="把公司制度、培训文档、产品资料粘贴到这里，AI 会按它出题…"
            value={content}
            onInput={(e) => setContent(e.detail.value)}
          />
          <View className="char-count">
            已输入 {content.length} 字{content.length >= 100000 ? "（已达上限）" : ""}
          </View>
          <Button
            className="btn ghost"
            loading={uploading}
            disabled={uploading}
            onClick={onPickFile}
          >
            {uploading ? "解析文档中…" : "＋ 上传文档 / 图片 / 扫描件（doc / pdf / 图片等）"}
          </Button>
          {uploadInfo && (
            <View className="upload-card">
              <View className="upload-card-head">
                <Text className="upload-card-title">上传成功</Text>
                <Text className="upload-card-meta">
                  {uploadInfo.filename} · {uploadInfo.chars} 字
                  {uploadInfo.truncated ? " · 超长已截取" : ""}
                </Text>
              </View>
              <View className="upload-card-preview">
                {uploadInfo.preview}
                {(uploadInfo.chars || 0) > 200 ? "…" : ""}
              </View>
            </View>
          )}
          <View className="field-row">
            <View className="field">
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
            <View className="field">
              <Text className="field-label">企业邀请码（可选）</Text>
              <Input
                className="field-input"
                placeholder="如 HQ2026"
                value={corpCode}
                onInput={(e) => setCorpCode(e.detail.value)}
              />
            </View>
          </View>
        </View>
      )}

      <View className="chips">
        <View className="chip on">
          <Text className="chip-n">①</Text>
          <Text>粘贴资料</Text>
        </View>
        <View className="chip">
          <Text className="chip-n">②</Text>
          <Text>AI 出题</Text>
        </View>
        <View className="chip">
          <Text className="chip-n">③</Text>
          <Text>答题闯关</Text>
        </View>
        <View className="chip">
          <Text className="chip-n">④</Text>
          <Text>AI 报告</Text>
        </View>
      </View>

      <Button
        className="btn green"
        loading={loading}
        disabled={loading}
        onClick={onGenerate}
      >
        {loading ? "AI 出题中…" : "开始闯关 →"}
      </Button>

      <View className="foot">钉在课桌上的草稿纸 · 001</View>
    </View>
  );
}
