# AI 闯关答题小程序（企业内部版）

> 把企业内部资料一键变成考核题：员工在微信里答题，管理者看团队薄弱点。

**技术栈**：Taro 4（React）· FastAPI · LangChain · DeepSeek · SQLite · Chroma 向量库

关联文档：《方案设计文档 v1.0》《需求分析文档 v1.0》位于仓库根目录，安装部署见《安装说明.md》。

---

## 项目简介

基于已验证开源项目 `liyupi/yu-ai-learn` 技术栈，面向企业培训考核场景的差异化实现：

- **无登录体系**：用「设备 ID + 临时企业码」区分数据，企业内部免注册即可使用
- **企业私有资料库**：上传制度 / 产品 / SOP 文档，RAG 精准出题，而非通用知识库
- **个人 + 团队双视角**：个人闯关报告之外，规划管理者视角的团队薄弱点报告

核心链路：**输入内容 → AI 生成题目 → 用户答题 → AI 生成分析报告**，数据落 SQLite。

## 核心特性

| 特性 | 说明 |
|------|------|
| AI 出题 | DeepSeek 按文本/RAG 资料生成单选、多选、判断、填空等题型 |
| RAG 精准出题 | 上传企业文档建库（Chroma + bge-small-zh 本地向量化），按资料出题 |
| 知识问答 | RAG 检索模式二：问答并展示来源引用 |
| 答题判分 | 提交答案自动判分，逐题记录 |
| AI 报告 | 得分 + 薄弱知识点 + 学习建议 |
| 数据隔离 | `corp_code` 企业码贯穿全链路，企业间数据互不可见 |
| 多端 | Taro 编译到微信小程序 + H5 双端 |

## 项目结构

```
mini-program/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/routes/   # 路由层: quiz / answer / report / upload / rag
│   │   ├── llm/             # LangChain 链: 出题 / 判分 / 报告 / 问答
│   │   ├── rag/             # RAG: chunker / embedding / store / service
│   │   ├── models/          # 数据模型(题库/答题/报告)
│   │   ├── services/        # 服务层
│   │   ├── utils/           # 文档解析 / OCR / ID 生成
│   │   └── main.py          # 入口(同源托管 H5 构建产物)
│   ├── rag_data/            # Chroma 向量库数据
│   ├── requirements.txt     # 后端依赖
│   ├── run_server.bat       # 一键启动脚本
│   └── install_rag.bat      # RAG 依赖安装(注意顺序)
├── frontend/                # Taro 前端
│   └── src/
│       ├── pages/           # index(首页) / kb(知识库) / quiz(答题) / report(报告)
│       ├── api/             # 接口封装(相对路径, dev 走 /api 代理)
│       └── config/          # Taro 编译配置(含 devServer 代理)
├── prototypes/              # 交互原型(HTML)
├── README.md                # 本文档
└── 安装说明.md               # 安装部署说明
```

## 已完成进度

> 对照《方案设计文档 v1.0》的四阶段规划，当前整体进度约 **60%**。

### ✅ 阶段 0 — 工程脚手架（完成）
FastAPI 分层后端 + Taro 前端 + 交互原型，与参照项目同构。

### ✅ 阶段 1 — MVP 核心闭环（完成，已全链路验证）
- [x] 首页输入文本 → AI 生成题目
- [x] 逐题作答 → 自动判分
- [x] 生成个人分析报告（得分 / 薄弱点 / 建议）
- [x] SQLite 落库（题库 / 答题 / 报告）
- [x] 文档转文本（doc / docx / pdf / txt / md / wps）
- [x] 图片 / 扫描件 OCR（PaddleOCR）

### 🟡 阶段 2 — 企业差异化增强（约 50%，RAG 核心已提前落地）
- [x] 企业文档上传 → RAG 精准出题（Chroma 向量库 + bge 本地 embedding）
- [x] 知识问答模式（答案 + 来源引用）
- [x] 前端知识库页（企业码 / 上传建库 / A/B 模式切换）
- [x] `corp_code` 企业码数据隔离
- [ ] 团队正确率聚合报告（管理者视角）
- [ ] 部门排行榜 `rank` 页

### ❌ 阶段 3 / 4 — 留存社交与变现（未开始）
错题本、间隔重复、挑战卡分享、职场模板库、SaaS / 私有化部署。

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/quiz/generate` | 文本生成题库 |
| POST | `/api/v1/quiz/submit` | 提交答案并判分 |
| POST | `/api/v1/quiz/upload-doc` | 上传文档转文本 |
| POST | `/api/v1/quiz/upload-image` | 上传图片 OCR |
| POST | `/api/v1/report/generate` | 生成分析报告 |
| POST | `/api/v1/rag/index` | 文档建库（离线） |
| POST | `/api/v1/rag/ask` | 检索出题 / 知识问答 |
| GET  | `/health` | 健康检查 |

## 快速开始

完整安装步骤（Python / Node / 依赖 / 环境变量 / 启动方式）见 **[《安装说明.md》](安装说明.md)**。

简要流程：

```bash
# 1. 后端：安装依赖并启动（端口 8000）
cd backend
pip install -r requirements.txt        # 基础依赖
install_rag.bat                         # RAG 依赖（注意安装顺序）
# 配置 backend/.env 填入 DEEPSEEK_API_KEY 后：
run_server.bat

# 2. 前端：安装依赖并启动 H5 开发（端口 10086，已配置 /api 代理）
cd frontend
npm install
npm run dev:h5
```

访问 H5：`http://localhost:10086`；生产部署时将 `frontend/dist` 构建产物由后端同源托管。
