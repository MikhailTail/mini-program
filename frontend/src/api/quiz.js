import Taro from "@tarojs/taro";
import { request, BASE_URL, miniHosts } from "../utils/request";

// 设备标识：替代登录，存本地
export function getDeviceId() {
  let id = Taro.getStorageSync("device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2, 10);
    Taro.setStorageSync("device_id", id);
  }
  return id;
}

// 1) 生成题库（LLM 生成耗时可能 30s+，放宽超时到 120s）
export function generateQuiz(content, n = 10, corp_code = null) {
  return request("/api/v1/quiz/generate", { content, n, corp_code }, "POST", 120000);
}

// 2) 提交答题并判分
export function submitQuiz(payload) {
  return request("/api/v1/quiz/submit", payload);
}

// 3) 生成报告（LLM 生成，放宽超时到 120s）
export function generateReport(payload) {
  return request("/api/v1/report/generate", payload, "POST", 120000);
}

function extractUploadError(data) {
  if (!data) return "上传失败";
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  return "上传失败";
}

// 小程序端上传（带地址回退：局域网 IP 失败自动切 127.0.0.1，保证模拟器可用）
async function miniUpload(urlPath, file, formData = null) {
  let lastErr = null;
  // Taro.uploadFile 不带原始文件名，后端拿到的 file.filename 是临时路径；
  // 把用户选择的原始文件名放进 formData，保证入库/列表展示与上传时一致
  const fd = { ...(formData || {}) };
  if (file && file.name) fd.filename = file.name;
  for (const host of miniHosts()) {
    try {
      const res = await Taro.uploadFile({
        url: host + urlPath,
        filePath: file.path,
        name: "file",
        formData: fd,
        timeout: 120000, // RAG 建库/解析可能耗时较长，放宽超时
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return JSON.parse(res.data);
      }
      // 服务器可达但业务失败：直接提示，不回退
      let msg = "上传失败";
      try {
        msg = extractUploadError(JSON.parse(res.data));
      } catch (e) {
        /* ignore */
      }
      Taro.showToast({ title: msg, icon: "none" });
      throw new Error(msg);
    } catch (e) {
      if (!(e && e.errMsg)) throw e; // 业务错误上抛
      lastErr = e; // 网络错误，尝试下一个候选地址
    }
  }
  const msg = (lastErr && lastErr.errMsg) || "上传失败（网络错误）";
  Taro.showToast({ title: msg, icon: "none" });
  throw new Error(msg);
}

// 4) 上传文档并解析为文本（支持 doc/docx/pdf/txt/md/wps）
export async function uploadDoc(file) {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    const fd = new FormData();
    fd.append("file", file);
    let res;
    try {
      res = await window.fetch("/api/v1/quiz/upload-doc", {
        method: "POST",
        body: fd,
      });
    } catch (e) {
      Taro.showToast({ title: "网络错误，无法连接服务器", icon: "none" });
      throw new Error("网络错误");
    }
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
  return miniUpload("/api/v1/quiz/upload-doc", file);
}

// 5) RAG 离线建库：上传文档 → 分块 → 向量化 → 存 Chroma
export async function ragIndexDoc(file, corp_code = "default") {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("corp_code", corp_code);
    let res;
    try {
      res = await window.fetch("/api/v1/rag/index", {
        method: "POST",
        body: fd,
      });
    } catch (e) {
      Taro.showToast({ title: "网络错误，无法连接服务器", icon: "none" });
      throw new Error("网络错误");
    }
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
  return miniUpload("/api/v1/rag/index", file, { corp_code });
}

// 6) RAG 检索问答 / 检索出题（LLM 生成，放宽超时到 120s）
export function ragAsk({ query, corp_code = "default", mode = "quiz", n = 5, top_k = 5 }) {
  return request("/api/v1/rag/ask", { query, corp_code, mode, n, top_k }, "POST", 120000);
}

// 7) 查看已入库文档列表（避免重复上传）
export function ragListDocs(corp_code = "default") {
  return request(
    `/api/v1/rag/documents?corp_code=${encodeURIComponent(corp_code)}`,
    {},
    "GET"
  );
}

// 8) 删除单个已入库文档（删除后同名文件可重新上传）
export function ragDeleteDoc(corp_code = "default", source) {
  return request(
    `/api/v1/rag/documents?corp_code=${encodeURIComponent(corp_code)}&source=${encodeURIComponent(source)}`,
    {},
    "DELETE"
  );
}

// 9) 验证企业码是否存在知识库（隔离门禁：输入对应企业码才能进入知识库页）
export function ragVerifyCorp(corp_code) {
  return request(
    `/api/v1/rag/corp/${encodeURIComponent(corp_code)}`,
    {},
    "GET"
  );
}
