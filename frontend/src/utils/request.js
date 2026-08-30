import Taro from "@tarojs/taro";

// 后端基地址：H5 由后端同源托管（FastAPI 挂载 dist），默认空字符串走相对路径，彻底避免跨域。
// 小程序端必须通过环境变量注入完整域名：
//   TARO_APP_API_BASE=https://api.example.com npx taro build --type weapp
export const BASE_URL = process.env.TARO_APP_API_BASE || "";

// Taro 4 的 H5 request 在部分浏览器环境下跨域不稳，H5 直接用原生 fetch（已实测稳定），小程序仍走 Taro.request。
// 注意：不能依赖 typeof window/document 判断环境——Taro 小程序运行时也会注入虚拟 window/document 对象（此前因此踩坑）。
// 用 Taro.getEnv() 运行时判断，两端绝对可靠。
const IS_H5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

// 小程序候选地址：优先注入的局域网 IP（真机可用），失败后回退本机 127.0.0.1（模拟器可用）
export function miniHosts() {
  const hosts = [BASE_URL];
  if (BASE_URL && !/localhost|127\.0\.0\.1/.test(BASE_URL)) {
    hosts.push("http://127.0.0.1:8000");
  }
  return hosts;
}

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
  let res;
  try {
    res = await window.fetch(BASE_URL + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method.toUpperCase() === "GET" ? undefined : JSON.stringify(data),
    });
  } catch (e) {
    const msg = `网络错误，无法连接服务器（${BASE_URL || "未知地址"}）`;
    Taro.showToast({ title: msg, icon: "none" });
    throw new Error(msg);
  }
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

async function miniRequest(url, data, method, timeout = 15000) {
  let lastErr = null;
  for (const host of miniHosts()) {
    try {
      const res = await Taro.request({
        url: host + url,
        method,
        data,
        header: { "Content-Type": "application/json" },
        timeout,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data;
      }
      // 服务器可达但返回业务错误：直接提示，不回退
      const msg = extractError(res.data);
      Taro.showToast({ title: msg, icon: "none" });
      throw new Error(msg);
    } catch (e) {
      if (!(e && e.errMsg)) throw e; // 业务错误上抛
      lastErr = e; // 网络错误，尝试下一个候选地址
    }
  }
  const msg = (lastErr && lastErr.errMsg) || "网络错误，无法连接服务器";
  Taro.showToast({ title: msg, icon: "none" });
  throw new Error(msg);
}

/**
 * 统一请求封装
 * @param {string} url 相对路径，如 /api/v1/quiz/generate
 * @param {object} data body 数据
 * @param {string} method
 */
export async function request(url, data = {}, method = "POST", timeout) {
  return IS_H5
    ? h5Request(url, data, method)
    : miniRequest(url, data, method, timeout);
}
