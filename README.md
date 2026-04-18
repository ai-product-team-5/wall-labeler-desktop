# wall-labeler-desktop

一个用于学习 `Electron + Vue + Python worker` 分层方式的桌面样板项目。  
业务仍然是墙体标注，但这次更强调“怎么读、怎么拆、怎么扩展”。

## 这个样板想帮你学什么

- Electron 主进程、preload、renderer 的边界
- Vue 组件怎么从“大文件”拆成 layout / panel / composable
- 为什么桌面项目里可以先用 `IPC + Python CLI worker`，不必一开始就上 FastAPI
- 如何把 Python 能力封装成一个稳定的命令行入口，再由 Electron 调用

## 对象层级原则

这个版本除了目录分层，也刻意保持对象分层一致：

- 前端应用层统一看 `editor.state / editor.view / editor.actions / editor.controls`
- 跨层桥接统一看 `dialogs / projects / worker`

也就是说：

- 在 Vue 里先看 `editor`
- 在 renderer 到 Electron 的桥接里先看 `desktopClient`
- 在 preload 里先看 `window.api`

每一层都先给你“几个大对象”，再进入细节。

## 推荐阅读顺序

1. [src/main.ts](src/main.ts)
2. [src/App.vue](src/App.vue)
3. `src/components/editor/*`
4. `src/composables/useProjectEditor.ts`
5. `src/services/desktop-client.ts`
6. [electron/preload.cjs](electron/preload.cjs)
7. [electron/main.cjs](electron/main.cjs) 和 `electron/main/*`
8. [python/label_worker.py](python/label_worker.py) 和 `python/worker/*`

更完整的分层说明见 [docs/architecture.md](docs/architecture.md)。

## 现在保留的功能

- 导入单张图片
- 自动识别候选拐点
- 吸附式画墙（中心线 + 宽度）
- 选中线并删除
- 保存项目 JSON
- 导出像素级 `mask.png`
- 浅色 / 深色主题切换

## 技术栈

- Electron
- Vue 3 + TypeScript
- Element Plus
- vue-konva / Konva
- Python + OpenCV

## 目录

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

## 安装依赖

### Node

推荐直接使用较新的 Node 版本。

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

Electron 主进程只会尝试：

- 开发环境：项目根目录下的 `.venv`
- 打包环境：应用资源目录里的 `python-runtime/` 和 `python/label_worker.py`

不会回退到系统 `python` / `py`。

### 前端依赖

```bash
npm install
```

## 开发与校验

开发运行：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

预览生产构建：

```bash
npm run build
npm run preview
```

## 为什么这里用 Electron IPC + Python worker

这个项目是一个本地桌面工具，当前目标是：

- 学清楚 Electron 分层
- 学清楚 Vue 组件和状态组织
- 给 Python 能力提供一个清晰的桌面调用样板

所以这里没有引入 FastAPI，而是选择：

- renderer 只调用 `desktop-client`
- renderer 内部继续按 `state / view / actions / controls` 组织应用状态
- preload 暴露最小 `window.api`
- `window.api` 继续按 `dialogs / projects / worker` 分组
- main 通过 IPC 处理文件和 worker 调用
- Python 通过命令行入口接收参数 / stdin，再输出 JSON

这个模式更适合本地工具，也更接近“以后不走 FastAPI，直接调用 Python 能力”的样板。

## 交互说明

- 左键：画点 / 选线
- 中键拖动：平移画布
- 滚轮：缩放
- Enter：完成当前线
- Esc：取消当前线
- C：切换角点吸附
- V：切换角点显示
- Delete / Backspace：删除已选线
- Ctrl/Cmd + S：保存

## 数据格式

### 项目文件

保存为 JSON。

核心字段：

- `image`：原图路径与尺寸
- `candidateCorners`：候选拐点
- `walls`：中心线 + 宽度
- `settings`：默认宽度、吸附半径、主题等

### 标签输出

导出为 `mask.png`。

- `0`：非墙
- `255`：墙
