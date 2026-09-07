# Cloudflare Workers 部署

线上地址为 **https://dreamro.hexly.ai**，Worker 名称为 `dreamro`。站点由 Workers Static Assets 托管，不需要数据库、服务端渲染或运行时模型密钥。

## 配置

`wrangler.jsonc` 指定 `dist/` 目录、SPA 回退和 `dreamro.hexly.ai` 自定义域名。Cloudflare 为自定义域名管理 DNS 与证书。账户 ID 是非敏感的账户标识；API Token 只保存在 GitHub Secrets 中。

`public/_headers` 为带哈希的构建资源设置长期缓存，`build-info.json` 禁止缓存。该文件包含版本和构建提交，用来确认 CD 实际发布了哪一份代码。

## GitHub Secrets

在 [Actions Secrets](https://github.com/nocoo/dreamro/settings/secrets/actions) 中配置以下两项，也可放在 `production` Environment 中：

| Secret | 值 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare「Edit Cloudflare Workers」API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 部署到的 Cloudflare Account ID |

在 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) 创建 Token 时，账户选择 Zheng Li Workspace，区域选择 `hexly.ai`。使用其他账户部署时，同时修改 `wrangler.jsonc` 中的账户与域名。

本机 `wrangler login` 的 OAuth 登录不能替代 GitHub Actions 的 API Token。不要把密钥放进仓库、Vite 环境变量或浏览器代码。

## CI

`.github/workflows/ci.yml` 在以下情况运行：推送到 `main`、向 `main` 提交 PR、手动触发。

```text
npm ci
  → 安装 Chromium
  → Playwright 浏览器测试
  → TypeScript 检查与 Vite 构建
  → Wrangler deploy --dry-run
  → 上传 worker-dist 构建产物
```

CI 使用 Node.js 22.12.0、npm 锁文件、Chromium 软件渲染和流畅画质。失败时保留浏览器截图与 trace。所有浏览器场景通过后才会产生用于连续部署的构建产物。

## CD

`.github/workflows/release.yml` 沿用本账户其他游戏项目的 `CI → Release → production` 流程，支持三种入口：

| 入口 | 发布内容 | 检查 |
| --- | --- | --- |
| `main` 的 CI 成功完成 | 该次 CI 验证的提交与构建产物 | 仓库、事件、分支、提交和产物版本一致 |
| 推送 `vX.Y.Z` 标签 | 标签对应提交 | 版本匹配，提交属于 main，重新运行测试和构建 |
| 手动运行 Release，填写标签 | 指定的 `vX.Y.Z` | 与标签推送相同 |

PR 的 CI 不触发部署。生产部署串行执行，自动发布前会再次检查 `main`，防止排队中的旧提交覆盖新版本。常规 `main` 部署直接使用 CI 上传的产物；标签发布则验证该标签自己的代码。

Wrangler 发布完成后，`scripts/verify-release.mjs` 检查线上版本与提交、首页、JavaScript / CSS、背景图片和 SPA 深层路由。检查通过后，Release 才显示成功。

## 版本发布

版本号以根目录 `package.json` 为准。更新版本时同步 npm 锁文件和 `CHANGELOG.md`：

```sh
npm version patch --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

需要重发已有版本时，在 [Release](https://github.com/nocoo/dreamro/actions/workflows/release.yml) 中选择 Run workflow 并输入对应标签。

## 本地验证

```sh
npm ci
npm run deploy:check
npm run preview:worker
```

本地 Workers 服务在 `http://localhost:8787`。这两个检查命令不会发布线上版本。维护时如需绕过 CD 手动部署，可使用 `npx wrangler login` 和 `npm run deploy`；正常发布使用 GitHub Actions。
