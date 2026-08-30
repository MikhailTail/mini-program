const os = require("os");

// 自动探测本机局域网 IPv4 地址（真机调试必须用电脑局域网 IP，127.0.0.1 在真机上指向手机自身）
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

const config = {
  projectName: "ai-quiz-enterprise",
  date: "2026-8-26",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "../dist",
  plugins: [],
  // 编译期注入后端地址：优先 TARO_APP_API_BASE 环境变量，否则自动用当前局域网 IP
  // （真机与模拟器均可达；小程序请求层另有 127.0.0.1 兜底，模拟器可用）
  defineConstants: {
    "process.env.TARO_APP_API_BASE": JSON.stringify(
      process.env.TARO_APP_API_BASE || `http://${getLanIP()}:8000`
    ),
  },
  copy: {
    patterns: [],
    options: {},
  },
  framework: "react",
  compiler: "webpack5",
  alias: {
    "@": "./src",
  },
  mini: {
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
  h5: {
    // 产物文件名带内容哈希，避免浏览器缓存旧版本 JS
    webpackChain(chain) {
      chain.output
        .filename("js/[name].[contenthash:8].js")
        .chunkFilename("chunk/[name].[contenthash:8].js");
    },
    publicPath: "/",
    staticDirectory: "static",
    // 本地开发：/api 代理到后端 FastAPI（生产 H5 由 FastAPI 同源托管，无需代理）
    devServer: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    postcss: {
      autoprefixer: { enable: true },
      cssModules: { enable: false },
    },
  },
};

module.exports = config;
