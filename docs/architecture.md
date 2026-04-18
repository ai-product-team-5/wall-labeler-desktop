# 架构导览

这个项目现在不是为了展示“最少代码”，而是为了展示一个**更容易学习的桌面项目分层**。

## 1. 总体调用链

```text
Vue 组件
  -> desktop-client.ts
  -> preload.cjs
  -> Electron IPC
  -> electron/main/*
  -> Python CLI worker
  -> JSON 结果返回 renderer
```

## 对象层级原则

除了目录结构，这个样板还统一了对象层级。

- 应用状态层：`state / view / actions / controls`
- 跨层调用层：`dialogs / projects / worker`

这两套分组会在 Vue、preload、renderer service、主进程 handler 里重复出现。  
目的不是增加抽象，而是让你在任何一层都先看到“对象边界”，再去看函数细节。

## 2. 前端分层

### `src/App.vue`

根视图只负责：

- 页面布局
- 连接各个 panel
- 把 composable 里的状态和动作接到模板上

它不再直接调用 `window.api`。

### `src/components/editor/*`

这些组件是教学版 UI 面板：

- `AppToolbar.vue`
- `EditorSettingsPanel.vue`
- `EditorStatusPanel.vue`
- `CanvasHud.vue`
- `WallListPanel.vue`
- `SelectedWallPanel.vue`

重点是让你看到：复杂界面可以拆成很多“小而明确”的面板，而不是全塞进一个根组件。

### `src/composables/useProjectEditor.ts`

这里是 renderer 侧的“应用状态 + 动作”层。

它负责：

- 项目状态
- 文件打开/保存动作
- 调用 Python worker 的业务动作
- 主题、选择、标脏、草稿状态同步

它的公共形状固定是：

- `editor.state`
- `editor.view`
- `editor.actions`
- `editor.controls`

### `src/services/desktop-client.ts`

这是 renderer 调 Electron 的稳定入口。

它的职责是：

- 把 `window.api` 收口到一个 TS 接口
- 让 Vue 组件和 composable 不直接碰 preload 注入对象

这层继续按能力域分组：

- `desktopClient.dialogs`
- `desktopClient.projects`
- `desktopClient.worker`

如果你以后不想用 FastAPI，而是继续走本地 Python worker，这一层就是最值得复用的样板。

## 3. Electron 分层

### `electron/preload.cjs`

最小桥接层。

它只做一件事：

- 把有限的桌面能力暴露成 `window.api`

并且保持分组清晰：

- `window.api.dialogs`
- `window.api.projects`
- `window.api.worker`

### `electron/main.cjs`

现在只是启动入口：

- app ready
- 注册 IPC
- 创建窗口

### `electron/main/*`

主进程按职责拆开：

- `window.cjs`：窗口创建和加载 renderer
- `ipc-handlers.cjs`：把 IPC channel 和处理函数集中在一起
- `project-files.cjs`：项目文件名、读写、序列化
- `image-payload.cjs`：图片元数据和 data URL
- `python-worker.cjs`：寻找 Python、启动 worker、收集 stdout/stderr

这样你以后读 Electron，不会再从一个几百行主进程文件开始。

## 4. Python 分层

### `python/label_worker.py`

薄入口，只负责把执行权交给 `worker.cli`。

### `python/worker/cli.py`

命令行入口层。

它负责：

- 定义命令
- 解析参数
- 统一错误输出
- 输出 JSON

这里也刻意保留了“命令注册表”的层级感，而不是继续使用长 `if/elif`。

### 算法与 IO 模块

- `corner_detection.py`：角点识别
- `mask_export.py`：导出 mask
- `io_utils.py`：unicode 路径读写、stdin 读取
- `models.py`：小数据结构

这是一种对以后扩新命令更友好的结构：

- 新能力先写模块
- 再在 `cli.py` 里挂一个命令
- Electron 不需要知道算法细节

## 5. 为什么这里没有 FastAPI

这里故意不引入 FastAPI，是因为当前目标是给**本地桌面调用 Python 能力**做样板。

如果一开始就引入 FastAPI，会把学习重点带到：

- HTTP API
- WebSocket
- 服务启动/部署
- 跨进程网络边界

但这个项目真正想展示的是：

- renderer 和 main 的边界
- main 和 Python worker 的边界
- Vue 如何围绕本地业务能力组织状态

所以这里选择更轻的路径：

- `IPC + CLI worker + JSON`

以后如果你要做可以被多端复用的后端，再把 Python core 通过 FastAPI 暴露出去会更自然。
