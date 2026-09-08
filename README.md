<p align="center"><img src="logo.png" width="128" height="128" alt="DreamRO" /></p>

<h1 align="center">DreamRO</h1>

<p align="center">创建角色、探索山谷，在浏览器中完成一段 RO 风格的单人冒险。</p>

<p align="center">
  <a href="https://dreamro.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

<p align="center">
  <img src="preview.jpg" width="720" alt="DreamRO 晨曦山谷中的旅人与波利" />
</p>

## 这是什么

DreamRO（仙境之梦）是一款致敬 Ragnarok Online 的单人网页 RPG。选择职业与外观，从晨曦山谷走到萤语森林和星落遗迹，完成向导任务并挑战波利女王。

游戏使用 Three.js 构建三维场景、角色和装备，配合窗口式界面、幻想插画和 Web Audio 合成声音。游戏逻辑与进度都在浏览器运行；当前没有云端账号、存档同步或多人联机。

## 功能

- 直接创建初心者、基础职业与进阶职业，每个职业有四个技能，覆盖近战、远程、治疗、护盾、持续伤害、范围法术与召唤。
- 探索三张相连地图，通过地面或大地图点击寻路，完成顺序任务并获得永久波利伙伴。
- 战斗升级、自动拾取、药水商店、宝箱、生命卡片与武器强化；倒地后保留等级、背包和任务进度。
- 通过状态栏、技能栏、背包、角色属性、任务手札和小地图查看当前状态。
- 支持键鼠与触屏摇杆、镜头旋转缩放、两档画质，以及独立的音乐、音效和音量设置。

角色呼吸、行走与攻击，波利跳跃、受击和消散，法阵与粒子效果均由代码驱动。美术、字体与设计参考见[素材说明](CREDITS.md)。

## 使用

使用支持 WebGL 2、已开启硬件加速的现代浏览器打开[游戏](https://dreamro.hexly.ai)。输入名字、选择职业并调整外观，点击「启程，去冒险」。基础和进阶职业都可直接选择，不需要先完成转职任务。

每个角色有独立进度，存于当前访问地址的 localStorage。再次打开时从「继续旅途」选择角色；游戏会自动保存，设置中也可手动保存。不同域名、浏览器和设备不共享存档，清理站点数据会移除本地进度。

| 操作 | 按键或手势 |
| --- | --- |
| 行走 | WASD / 方向键 / 触屏摇杆 |
| 自动寻路 | 点击地面或大地图目的地 |
| 选择魔物并自动攻击 | 点击魔物 / Space / 触屏攻击按钮 |
| 职业技能 | 1–4 / 点击技能栏 |
| 红色药水 / 蓝色药水 | Q / E |
| 交谈、打开宝箱 | 靠近后按 F / 点击交互提示 |
| 切换目标 | Tab |
| 旋转、缩放、重置镜头 | 鼠标右键拖动 / 滚轮 / R |
| 背包、角色、手札、地图 | I / C / J / M |
| 设置、关闭窗口 | Esc |

打开游戏窗口会暂停战斗。移动可取消自动攻击，便于躲避女王的地面预警范围。设备发热或帧率偏低时，可在设置中选择「流畅」画质；完整任务与成长规则见[玩法说明](docs/gameplay.md)。

## 开发

使用 Node.js 22.12 或更新版本与 npm；浏览器需要 WebGL 2。

```bash
git clone https://github.com/nocoo/dreamro.git
cd dreamro
npm ci
npm run dev
```

Vite 默认使用 5173，端口占用时自动选择下一个，访问终端显示的地址。可以用 `npm run dev -- --port 5174` 指定端口；不同端口也会使用不同的浏览器存档。

```bash
npm run typecheck
npm run build
npm run preview
```

构建结果位于 `dist/`，附带当前版本与提交信息。应用没有必需的服务端凭据或数据库；Cloudflare Workers Static Assets 托管配置见 [wrangler.jsonc](wrangler.jsonc)，自行部署步骤见[部署说明](docs/deployment.md)。

| 路径 | 内容 |
| --- | --- |
| `src/data/jobs.ts` | 职业、属性与技能配置 |
| `src/game` | 三维角色、地图、战斗、A* 寻路、音频与存档 |
| `src/main.ts`、`src/ui` | 角色创建、应用生命周期、窗口与触屏操作 |
| `public` | 插画、本地字体和缓存配置 |
| `tests` | 浏览器冒险流程、职业、Boss 与渲染回归 |

## 测试

```bash
npx playwright install chromium
npm test
```

Playwright 自动启动独立开发服务，使用 `127.0.0.1:5188` 和隔离浏览器存档。运行前确保该端口空闲，避免复用无关服务；Linux 环境可用 `npx playwright install --with-deps chromium` 安装浏览器依赖。

当前测试覆盖角色创建、职业技能、地图任务、女王战、存档、复活和触屏操作。测试配置在 macOS 使用 Metal，在 Linux 使用 Chromium 软件渲染；失败时保留截图与 trace。仓库没有独立的单元或服务端 API 测试命令，类型检查与构建使用开发章节中的命令。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)

| 部分 | 实现 |
| --- | --- |
| 游戏与界面 | TypeScript、DOM、CSS、SVG |
| 三维渲染 | Three.js、WebGL 2、Canvas 纹理 |
| 音频与进度 | Web Audio、localStorage |
| 构建与托管 | Vite、Cloudflare Workers Static Assets |
| 浏览器测试 | Playwright |

## 文档

- [玩法说明](docs/gameplay.md)
- [部署说明](docs/deployment.md)
- [素材与参考](CREDITS.md)
- [变更记录](CHANGELOG.md)

## 许可证

[MIT](LICENSE) © 2026 Zheng Li。随应用分发的 Cinzel 与 Cormorant Garamond 字体采用 SIL Open Font License，详见[素材与参考](CREDITS.md)。DreamRO 是独立致敬作品；Ragnarok Online / RO 名称与相关标识属于其各自权利人。
