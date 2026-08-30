const base = require("./index");
// 保留 index.js 的 defineConstants（自动注入局域网 API 地址），供 prod 构建使用
module.exports = base;
