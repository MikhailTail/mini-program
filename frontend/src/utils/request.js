import Taro from "@tarojs/taro";

// 后端基地址：H5 由后端同源托管（FastAPI 挂载 dist），默认空字符串走相对路径，彻底避免跨域。
// 小程序端必须通过环境变量注入完整域名：
//   TARO_APP_API_BASE=https://api.example.com npx taro build --type weapp
export const BASE_URL = process.env.TARO_APP_API_BASE || "";

// Taro 4 的 H5 request 在部分浏览器环境下跨域不稳，H5 直接用原生 fetch（已实测稳定），小程序仍走 Taro.request。
// 注意：不能依赖 process.env.TARO_ENV 判断（Taro 4 H5 构建未可靠替换该值），用 window 是否存在做运行时判断。
const IS_H5 = typeof window !== "undefined";

function extractError(data) {
  if (!data) return "请求失败";
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    const msgs = data.detail.map((d) => d.msg || "").filter(Boolean);
    return msgs.length ? msgs.join("; ") : "请求失败";
  }
  return "请求失败";
}

async function h5Request(url, data, method) {
  const res = await window.fetch(BASE_URL + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method.toUpperCase() === "GET" ? undefined : JSON.stringify(data),
  });
  if (!res.ok) {
    let payload = null;
    try {
      payload = await res.json();
    } catch (e) {
      /* 非 JSON 响应 */
    }
    const msg = extractError(payload);
    Taro.showToast({ title: msg, icon: "none" });
    throw new Error(msg);
  }
  return res.json();
}

async function miniRequest(url, data, method) {
  const res = await Taro.request({
    url: BASE_URL + url,
    method,
    data,
    header: { "Content-Type": "application/json" },
    timeout: 60000,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data;
  }
  const msg = extractError(res.data);
  Taro.showToast({ title: msg, icon: "none" });
  throw new Error(msg);
}

/**
 * 统一请求封装
 * @param {string} url 相对路径，如 /api/v1/quiz/generate
 * @param {object} data body 数据
 * @param {string} method
 */
export async function request(url, data = {}, method = "POST") {
  return IS_H5 ? h5Request(url, data, method) : miniRequest(url, data, method);
}
