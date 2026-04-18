# Wall Label

一个面向平面图墙体标注的桌面工具。

## 现在有的

- 导入单张图片
- 自动识别候选拐点
- 吸附式画墙（中心线 + 宽度）
- 选中线并删除
- 保存项目 JSON
- 导出像素级 `mask.png`
- 浅色界面，支持简单明暗切换

## 技术栈

- Electron
- Vue 3 + TypeScript
- Element Plus
- vue-konva / Konva
- Python + OpenCV

## 目录

```text
.
├─ electron/
│  ├─ main.cjs
│  └─ preload.cjs
├─ python/
│  ├─ label_worker.py
│  └─ requirements.txt
├─ scripts/
│  └─ dev.mjs
├─ src/
│  ├─ components/
│  │  ├─ CanvasBoard.vue
│  │  └─ ToolIconButton.vue
│  ├─ composables/
│  ├─ types/
│  ├─ utils/
│  ├─ App.vue
│  ├─ main.ts
│  └─ style.css
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 先装依赖

### Node

推荐直接用较新的 Node 版本。

### Python

只使用项目自己的虚拟环境，不使用系统 Python。

推荐：

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

Electron 主进程现在只会尝试：

- 开发环境：项目根目录下的 `.venv`
- 打包环境：应用资源目录里的 `python-runtime/` 和 `python/label_worker.py`

不会再回退到系统 `python` / `py`。

## 安装前端依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

## 预览生产构建

```bash
npm run build
npm run preview
```

## 发布说明

当前仓库还不能直接产出可分发给同学双击使用的 `exe`。

现在已经具备的是：

- 开发环境严格使用项目自己的 `.venv`
- 发布版代码路径预留了随包 Python 运行时的位置

还缺的是：

- Electron 打包工具链，例如 `electron-builder`
- 将 `python/label_worker.py` 作为资源一起打包
- 将独立的 Python 运行时和依赖一起放进发布包，例如 `resources/python-runtime/`

注意：

- 项目里的 `.venv` 适合开发，不适合原样复制给同学作为发布运行时

也就是说：

- 现在适合本机开发
- 还不适合直接把一个 `exe` 扔给同学就用

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

## 设计取舍

第一版不做复杂编辑，只做：

- 画
- 选
- 删
- 重画

这样可以保持交互简单，也更稳。
