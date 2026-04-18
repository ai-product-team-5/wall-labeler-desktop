# 架构导览

本文档描述 `wall-labeler-desktop` 的当前实现结构，便于维护和后续开发。

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

## 2. 对象分组约定

项目里有两套固定分组约定：

- 应用状态层：`state / view / actions / controls`
- 跨层调用层：`dialogs / projects / worker`

这两套分组会在 Vue、renderer service、preload 和主进程 IPC 注册里重复出现，用来保持命名和职责一致。

## 3. 前端结构

### `src/App.vue`

根视图负责：

- 页面布局
- 连接工具栏、侧栏和画布
- 把 composable 中的状态与动作接到模板上

### `src/components/editor/*`

这些组件负责界面分区：

- `AppToolbar.vue`
- `EditorSettingsPanel.vue`
- `EditorStatusPanel.vue`
- `CanvasHud.vue`
- `WallListPanel.vue`
- `SelectedWallPanel.vue`

### `src/composables/useProjectEditor.ts`

这是 renderer 侧的业务状态与动作入口，负责：

- 项目状态
- 文件打开与保存
- Python worker 相关业务动作
- 主题、选择状态、草稿状态同步

它对外统一提供：

- `editor.state`
- `editor.view`
- `editor.actions`
- `editor.controls`

### `src/services/desktop-client.ts`

这是 renderer 调 Electron 的统一入口，负责把 `window.api` 收口为 TS 接口。

它继续按能力域分组：

- `desktopClient.dialogs`
- `desktopClient.projects`
- `desktopClient.worker`

## 4. Electron 结构

### `electron/preload.cjs`

预加载脚本只暴露有限的桌面能力到 `window.api`，并保持以下分组：

- `window.api.dialogs`
- `window.api.projects`
- `window.api.worker`

### `electron/main.cjs`

主入口负责：

- 等待 Electron app ready
- 注册 IPC
- 创建主窗口

### `electron/main/*`

主进程逻辑按职责拆分：

- `window.cjs`：窗口创建和加载 renderer
- `ipc-handlers.cjs`：IPC channel 与处理函数注册
- `project-files.cjs`：项目文件读写
- `image-payload.cjs`：图片元数据与 data URL
- `python-worker.cjs`：Python worker 的定位、启动与输出收集

## 5. Python 结构

### `python/label_worker.py`

CLI 薄入口，只负责把执行权转交给 `worker.cli`。

### `python/worker/cli.py`

命令行入口层负责：

- 定义命令
- 解析参数
- 统一错误输出
- 输出 JSON

### 算法与 IO 模块

- `corner_detection.py`：角点识别
- `mask_export.py`：导出 mask
- `io_utils.py`：路径与 stdin 读写
- `models.py`：小型数据结构

## 6. 通信方式

这个项目当前使用本地桌面应用常见的通信路径：

- renderer 不直接访问 Node / Python
- renderer 通过 preload 暴露的 `window.api` 调用主进程
- 主进程通过 IPC 处理文件系统和 Python worker
- Python worker 通过命令行参数和 JSON 输入输出与主进程通信

当前实现没有引入 HTTP 或 WebSocket 层，桌面侧能力通过本地 IPC 和 CLI worker 完成。
