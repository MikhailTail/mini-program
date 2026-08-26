import Taro from "@tarojs/taro";
import { request } from "../utils/request";

// 设备标识：替代登录，存本地
export function getDeviceId() {
  let id = Taro.getStorageSync("device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2, 10);
    Taro.setStorageSync("device_id", id);
  }
  return id;
}

// 1) 生成题库
export function generateQuiz(content, n = 10, corp_code = null) {
  return request("/api/v1/quiz/generate", { content, n, corp_code });
}

// 2) 提交答题并判分
export function submitQuiz(payload) {
  return request("/api/v1/quiz/submit", payload);
}

// 3) 生成报告
export function generateReport(payload) {
  return request("/api/v1/report/generate", payload);
}

function extractUploadError(data) {
  if (!data) return "上传失败";
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  return "上传失败";
}

// 4) 上传文档并解析为文本（支持 doc/docx/pdf/txt/md/wps）
export async function uploadDoc(file) {
  if (typeof window !== "undefined") {
    const fd = new FormData();
    fd.append("file", file);
    const res = await window.fetch("/api/v1/quiz/upload-doc", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      let payload = null;
      try {
        payload = await res.json();
      } catch (e) {
        /* 非 JSON 响应 */
      }
      const msg = extractUploadError(payload);
      Taro.showToast({ title: msg, icon: "none" });
      throw new Error(msg);
    }
    return res.json();
  }
  const res = await Taro.uploadFile({
    url: "/api/v1/quiz/upload-doc",
    filePath: file.path,
    name: "file",
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return JSON.parse(res.data);
  }
  let msg = "上传失败";
  try {
    msg = extractUploadError(JSON.parse(res.data));
  } catch (e) {
    /* ignore */
  }
  Taro.showToast({ title: msg, icon: "none" });
  throw new Error(msg);
}

// 5) RAG 离线建库：上传文档 → 分块 → 向量化 → 存 Chroma
export async function ragIndexDoc(file, corp_code = "default") {
  if (typeof window !== "undefined") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("corp_code", corp_code);
    const res = await window.fetch("/api/v1/rag/index", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      let payload = null;
      try {
        payload = await res.json();
      } catch (e) {
        /* 非 JSON 响应 */
      }
      const msg = extractUploadError(payload);
      Taro.showToast({ title: msg, icon: "none" });
      throw new Error(msg);
    }
    return res.json();
  }
  const res = await Taro.uploadFile({
    url: "/api/v1/rag/index",
    filePath: file.path,
    name: "file",
    formData: { corp_code },
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return JSON.parse(res.data);
  }
  let msg = "上传失败";
  try {
    msg = extractUploadError(JSON.parse(res.data));
  } catch (e) {
    /* ignore */
  }
  Taro.showToast({ title: msg, icon: "none" });
  throw new Error(msg);
}

// 6) RAG 检索问答 / 检索出题（mode=quiz 出题，mode=answer 回答）
export function ragAsk({ query, corp_code = "default", mode = "quiz", n = 5, top_k = 5 }) {
  return request("/api/v1/rag/ask", { query, corp_code, mode, n, top_k });
}
