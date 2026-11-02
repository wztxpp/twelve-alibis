# twelve-alibis · 空席 / 十二份证词

Vue 3 + Vite 实现的中文推理网页游戏。十二名乘客，同一艘邮轮上的三个连续章节。搜集记录、比较证词，正确判断会解锁人物对话、后果与后续剧情。

这是完整可运行的前端源码：包含三章剧情、谜题数据、12张差异化邮轮角色立绘、36段角色配音、语音模块和测试。没有后端、账号系统、API密钥或外部图片依赖。

## Windows 快速启动

1. 安装 **Node.js 24 LTS** 和 Git。兼容要求：Node `^20.19.0 || >=22.12.0`。
2. 克隆仓库，在 PowerShell 中进入目录：

```powershell
git clone https://github.com/wztxpp/twelve-alibis.git
cd twelve-alibis
```
3. 执行：

```powershell
npm ci
npm run dev
```

浏览器打开 **http://127.0.0.1:5180/**。

开发服务器固定使用 **5180**，设置 `strictPort: true`。如果端口被占用，会明确报错，不会悄悄改到5173或其他端口。先关闭占用5180的程序再启动。停止服务器按 `Ctrl+C`。

也可以下载 GitHub 的 ZIP、解压后在该文件夹执行同样命令。`npm ci` 使用提交的锁文件，避免各机器装出不同版本。

## 常用命令

```powershell
npm run dev       # 开发，热更新，5180
npm test          # 自动化测试
npm run build     # 生成 dist/ 静态部署产物
npm run preview   # 本地检查 dist/，5180
npm run check     # 测试 + 正式打包
```

运行preview之前先停止dev，两者故意使用相同固定端口。Node测试无需Python；仓库若包含独立Python验证器，可额外使用Python 3执行，作为第二套审计。

## 项目结构

- `src/App.vue`：应用入口与页面布局。
- `src/components/`：Vue单文件组件；人物卡、现场档案、剧情等界面。
- `src/composables/`：章节状态、进度、选择与交互逻辑。
- `src/data/puzzles.json`：完整角色、剧情、物证、证词与严格逻辑数据。
- `src/logic/puzzle.js`：不依赖DOM的纯逻辑求值与答案校验。
- `src/audio/speech.js`：设备中文系统朗读；显式播放、停止、切章取消。
- `public/assets/cruise-01.webp` … `cruise-12.webp`：本地角色立绘。
- `tests/`：谜题与语音生命周期回归。
- `vite.config.js`：Vue插件、开发/预览端口配置。

详见 [内容编辑与架构](docs/DEVELOPMENT.md)。

## 语音与存档限制

“听证词”优先播放随项目附带的 **36段原创角色合成配音**，12名角色拥有按年龄与性格设计的声线；不是模仿真人或演员。全部免费在本地CPU环境生成，玩家无需TTS模型或API密钥。录音失败后，再次明确点击可改用设备中文系统朗读。没有中文系统音色时会提示；后备音色因设备而异。无需麦克风，不自动播放，同时只播放一份证词。来源与验证限制见 [配音说明](docs/AUDIO.md) 和 [生成审计](docs/audio-audit.json)。

进度与私人推理便签仅存在当前浏览器的localStorage，不会上传。换浏览器、清理站点数据或选择“重新开始全篇”会失去这些进度。

## 协作约定

建议新功能在独立分支开发，通过测试后合并。不要提交`node_modules`、`dist`、`.env`或任何凭据。本仓库没有内部托管服务的凭证、配置或历史；GitHub提交不会自动改变已有在线试玩站点。

角色美术为本项目AI生成的虚构成人形象，不表示人物证词真假。当前仓库未授予通用开源许可；如计划公开发行，请另行确定代码和素材使用条款。
