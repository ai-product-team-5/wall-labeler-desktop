# wall-labeler-desktop

一个用于室内平面图墙体标注、角点辅助识别与 `mask` 导出的桌面工具，
服务于小组室内平面图导航项目的数据准备流程。

## 项目用途

这个工具当前主要承担三类工作：

- 导入室内平面图并做人工墙线标注
- 基于图像自动识别候选角点，辅助标注
- 导出项目文件和墙体 `mask`，供后续流程使用

## 当前能力

- 导入单张平面图
- 自动识别候选角点
- 以中心线 + 宽度的方式画墙
- 吸附到候选角点和已有墙线端点
- 选中、取消选择和删除线段
- 保存项目 JSON
- 导出像素级 `mask.png`
- 支持浅色 / 深色主题
- 可打包为 Windows portable 可执行文件

## 技术实现

- Electron
- Vue 3 + TypeScript
- Element Plus
- vue-konva / Konva
- Python + OpenCV

项目内部采用 `Electron IPC + Python worker` 的方式调用图像处理能力：

- renderer 负责界面和交互
- Electron 主进程负责文件系统和 worker 调度
- Python worker 负责角点检测与 mask 导出

## 目录结构

```text
.
├─ docs/
│  └─ architecture.md
├─ electron/
│  ├─ main.cjs
│  ├─ preload.cjs
│  └─ main/
│     ├─ config.cjs
│     ├─ image-payload.cjs
│     ├─ ipc-handlers.cjs
│     ├─ project-files.cjs
│     ├─ python-worker.cjs
│     └─ window.cjs
├─ python/
│  ├─ label_worker.py
│  ├─ requirements.txt
│  └─ worker/
│     ├─ cli.py
│     ├─ corner_detection.py
│     ├─ io_utils.py
│     ├─ mask_export.py
│     └─ models.py
├─ src/
│  ├─ components/
│  │  ├─ editor/
│  │  ├─ CanvasBoard.vue
│  │  └─ ToolIconButton.vue
│  ├─ composables/
│  │  ├─ canvas/
│  │  ├─ useProjectEditor.ts
│  │  └─ useProjectKeyboardShortcuts.ts
│  ├─ services/
│  │  └─ desktop-client.ts
│  ├─ types/
│  ├─ utils/
│  ├─ App.vue
│  ├─ main.ts
│  └─ style.css
├─ scripts/
├─ package.json
└─ vite.config.ts
```

`docs/architecture.md` 记录的是实现分层和模块边界，便于维护代码和后续开发。

## 环境准备

### Node

推荐使用较新的 Node 版本。

### Python

只使用项目自己的虚拟环境，不使用系统 Python。

创建虚拟环境：

```bash
uv venv
```

Windows 安装依赖：

```bash
.\.venv\Scripts\python.exe -m pip install -r python\requirements.txt
```

macOS / Linux 安装依赖：

```bash
./.venv/bin/python -m pip install -r python/requirements.txt
```

### 前端依赖

```bash
npm install
```

## 开发运行

启动开发环境：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

构建前端并本地预览：

```bash
npm run build
npm run preview
```

## Windows 打包

构建 Python worker：

```bash
npm run build:worker
```

构建 Windows portable 包：

```bash
npm run dist:win
```

打包结果输出到：

- `release/`

## 交互说明

- 左键：画点 / 选线
- 中键或右键拖动：平移画布
- 滚轮：缩放
- Enter：完成当前线
- Esc：取消当前线
- C：切换角点吸附
- V：切换角点显示
- Delete / Backspace：删除已选线
- Ctrl/Cmd + S：保存

## 数据输出

### 项目文件

保存为 JSON。

核心字段：

- `image`：原图路径与尺寸
- `candidateCorners`：候选角点
- `walls`：中心线 + 宽度
- `settings`：默认宽度、吸附半径、主题等

### Mask

导出为 `mask.png`。

- `0`：非墙
- `255`：墙

## 当前边界

这个工具当前专注在“标注与导出”这一步，不负责：

- 导航推理本身
- 路径规划
- 多端同步
- 通用后端服务

也就是说，它是导航项目链路里的一个桌面标注工具，而不是整个系统的总入口。
