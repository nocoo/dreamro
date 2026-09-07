# 素材与参考

## 原创美术与声音

- **角色创建背景**：`public/art/dawnlight.webp`。通过 Azure OpenAI 的 `gpt-image-2` 生成，使用 high 质量、1536 × 1024 输出，再转换为 WebP。完整生成提示保存在 `art/prompts/dawnlight.txt`。
- **角色、职业装备、波利和三张地图**：以 Three.js 几何体和自定义材质程序化创建。面部、水面、地面和魔法纹理由 Canvas 绘制；场景包含碰撞、可通行桥梁和动态元素。
- **界面纹样与图标**：`src/ui/icons.ts` 中的原创 SVG。
- **音乐与音效**：`src/game/Audio.ts` 使用 Web Audio 合成的原创竖琴旋律、和弦与游戏音效。

## 字体

两个西文字体随应用本地提供，均使用 SIL Open Font License 1.1；中文使用设备已有的宋体／系统字体。

| 字体 | 来源 | 授权文件 |
| --- | --- | --- |
| Cinzel | [Cinzel / Google Fonts](https://fonts.google.com/specimen/Cinzel) | [cinzel-OFL.txt](public/fonts/cinzel-OFL.txt) |
| Cormorant Garamond | [Cormorant Garamond / Google Fonts](https://fonts.google.com/specimen/Cormorant+Garamond) | [cormorantgaramond-OFL.txt](public/fonts/cormorantgaramond-OFL.txt) |

## 游戏设计参考

DreamRO 是献给《Ragnarok Online》记忆的独立致敬作品。参考了经典作品的可爱角色比例、幻想职业、波利意象与窗口式界面，以及 [RO 官方游戏介绍](https://renewal.playragnarok.com/gameguide/features.aspx)。职业选择也参考了传统 MMORPG 的直接选择方式。

本项目的角色模型、地图、图标、背景和音频均为本次制作；职业技能和成长数值为适合浏览器单人冒险的原创实现。Ragnarok Online / RO 名称与相关标识属于其各自权利人。
