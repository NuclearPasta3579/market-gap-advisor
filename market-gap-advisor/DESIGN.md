# 市场补缺顾问：设计与验证说明

> 依据本机安装的 DSH `0.2.2-rc.3` 的包文档、源码和运行时 Inspect 契约核对。**本插件已安装到 desktop profile（本地 link），但本次未做第三方插件的成功安装验证**；下文“已核对”只指 API/工具契约与已实际执行的部分，不是“已实测全部可用”。

## 1. 现状与缺口

已存在的能力：

| 能力 | 位置 | 作用 |
|:--|:--|:--|
| `plugin_market` 工具（只读） | 由「自定义插件索引」bundle 提供 | 列索引源、按关键词搜条目、列版本，并给出精确的 `install.target` 与 registry |
| `plugin_manager` 工具 | 有 profile 的会话 | `install_bundle` 安装、`list_bundles` 查状态；**每个动作**都要 danger-full-access 授权或审批 |
| 「发现」页 | 插件页标签页 | 由人浏览索引并安装 |
| `action-cards` + `plugin-recommendations` | 个性化推荐 bundle | 仅覆盖“随安装提供的官方可选插件”，卡片动作为 `enable_official_plugin` |
| `official-plugins` skill | 同上 | 只在内置目录中匹配 |

缺口：没有“发现能力缺失 → 查市场 → 征询 → 安装”的闭环；市场条目没有像内置插件那样的可点击卡片。

## 2. 设计目标与非目标

目标：在能力缺失被发现时，用最小打扰给出至多一个市场候选；安装前必须得到用户本轮明确同意；结果如实报告；拒绝后不再打扰。

非目标：自动安装；自动增删索引源；把任意 URL 当安装源；替用户决定版本豁免；v1 提供卡片或详情页。

## 3. 形态：Host-only 的 skill bundle

```
market-gap-advisor/
  package.json          # dsh.bundle.patch 指向 cordis.patch.yml
  cordis.patch.yml      # 插入一行 Host 插件
  index.js              # 注册 runtime skill（ctx.skills.register）
  skills/market-gap.md  # 触发条件、检索流程、询问与安装规则
  locale/{en,zh}.json   # 插件页标题与说明
  icon.svg
```

选择 skill 而不是其他扩展点的理由：

- **不新增工具**：市场检索已由 `plugin_market` 提供；新增工具会让所有会话看到一份常驻 schema，并需要确认它在目标 preset 的工具集中可见。v1 复用现有工具，避免这两项成本。
- **不新增卡片**：卡片种类需要浏览器端正文包来渲染「安装」按钮；只有 Host 端时卡片仅显示标题、说明和「暂不需要」。v1 用 `ask_user_question` 完成“询问”，更小且不依赖客户端构建。
- **不常驻系统提示词**：按需加载的 skill 只在目录中有条目，加载后才注入正文，符合现有 `official-plugins` 的惯例。

`ctx.skills.register` 在本机 0.2.2-rc.3 的 `skills` 服务契约中存在，接受 `SkillRegistration`（`name`、`description`、`content`、`source`，可选 `invocation`/`provider`）。本插件把 `source` 标为 `runtime`，因为它是本地插件在运行时注册的，不是随 DSH 分发的 `bundled` skill。

注意：skill 正文在插件激活时读入一次；之后修改 `skills/market-gap.md` 需要重载插件或重启 DSH 才会生效。

## 4. 数据流

1. 模型判断“能力缺失”，且现有功能、内置插件都不覆盖；
2. 加载 skill，用 `plugin_market` 的 `list_indexes` 取索引，**对每个可用索引**分别 `list_plugins` 搜索；合并、去重，最多保留 3 个内部候选；
3. 排除 `installed`/`provided`，优先 `compatibility.compatible === true` 且未安装的条目；默认版本不兼容时用 `list_versions` 找兼容版本；
4. 回答正文说明缺口与一个候选，`ask_user_question` 只问一次（安装并启用 / 仅下载 / 暂不安装）；
5. 用户选择后，`plugin_manager.install_bundle`（`target`/`registry` 原样取市场结果；仅下载传 `enabled: false`）→ 该调用自身再做权限检查/审批；
6. 按 `ChangeResult` 报告 applied / restart-required / failed / cancelled / overridden；核对返回的 `bundle`/`version`；需要批准构建脚本时单独询问。

**不在流程中调用 `plugin_manager` 的列目录动作**：`plugin_market` 已返回 `installation.status`，再调 `list_bundles` 只会多触发一次授权或审批。

## 5. 权限与安全

- 安装修改 profile、影响所有会话，且安装的 Host 代码在宿主进程中运行——必须由用户明确同意，并由 `plugin_manager` 的授权/审批兜底；skill 不能绕过审批。
- 市场文本是不可信数据：只用于匹配与展示，不作为指令；安装目标只接受市场条目给出的精确 spec。
- 版本不兼容（`engines.dsh` / peer 拒绝）时拒绝安装；版本豁免需要用户对确切插件与运行时版本的单独确认，v1 不提供该路径。
- 构建脚本（`pendingBuilds`）必须单独征得用户同意，不能自动填入 `approvedBuilds`。
- 失败不自动重试；第三方索引不可达或无结果时如实说明，不编造条目。
- 索引源由用户配置；本插件不添加、删除或修改索引源。

## 6. 失败与边界

| 情况 | 行为 |
|:--|:--|
| 无索引源 | 指向「插件 → 发现」添加，不继续 |
| 部分索引不可达 | 跳过该索引，用其余索引继续，并说明哪个不可用 |
| 条目消失 / 无匹配 | 说明不可用或没有匹配；不安装缓存中的旧信息 |
| 不兼容 / 平台不支持 | 不安装；说明原因 |
| 已安装（`installed`/`provided`） | 不重复安装；提示启用、更新或卸载路径 |
| 安装取消/失败 | 说明已回滚及原因，询问是否重试 |
| 需要批准构建脚本 | 单独询问；明确同意后才带 `approvedBuilds` 重试 |
| 需要重启 | 明确“重启后才生效” |
| 被更高优先级层覆盖（`overridden`） | 说明未生效 |
| `plugin_market` 不可用 | 提示改用「发现」页或启用「自定义插件索引」，不编造条目 |
| `plugin_manager` 不可用 | 只给候选和「发现」页安装路径，不用 shell 或手改 profile 代替 |
| 用户拒绝 | 本会话不再推荐该插件（除非用户再次主动要求） |

## 7. 验证状态

本次已核对：

- `ctx.skills.register` / `SkillRegistration` 契约（0.2.2-rc.3 运行时 Inspect）；
- `plugin_market` 的 `list_indexes` / `list_plugins` / `list_versions` 参数、`target` 必填、`limit` 上限，以及结果中的 `installation`、`compatibility`、`install.target`/`registry`；
- `plugin_manager` 的每次动作都需要 danger-full-access 授权或审批，`install_bundle` 支持 `enabled`、`registry`、`approvedBuilds`，但不支持 `expected`；
- 当前 desktop profile 已配置索引源，且 `plugin_market` 实际返回了候选（npm 与 git#commit 两种 target）；
- 本 bundle 已安装到 desktop profile（`@local/market-gap-advisor`，`link:` 本地目录），skill 已出现在运行时技能目录；
- 实际执行了一次“检索 → 询问 → 安装尝试”（见下方实测记录）；安装被 `incompatible-version` 拒绝，未写入 profile；
- 本 bundle 的 JS 语法、JSON 与 YAML 结构。

本次未验证：

- 插件行、标题/说明/图标的实际渲染；
- 真实第三方插件的**成功**安装（只验证了拒绝路径）；
- `pendingBuilds` 审批路径；
- 重启/HMR 后的行为。

实测记录（2026-11-18）：

- 通过本 skill 的流程尝试安装 `@limuyang2/dsh-agent-team@0.1.4`（来源：Awesome DSH Plugin）。市场条目标注 `compatibility.compatible: true`，但 `plugin_manager` 以 `incompatible-version` 拒绝：该包要求 `^0.1.1-rc.2` 的 DSH peer 依赖，运行时是 `0.2.2-rc.3`。返回 `changed: false`，未写入 profile，未授予版本豁免。
- 结论：市场条目的 `compatibility` 只是索引侧标注，不是安装成功的保证；skill 已补上这条边界。

后续在具备 `plugin_manager` 的会话中按以下步骤验证：

1. 安装本目录（GUI「添加插件」或 `install_bundle` 绝对路径），确认插件行与标题/说明/图标无诊断；
2. 新会话的 skill 目录出现 `market-gap-advisor`；加载后正文正确；
3. 构造“缺能力”请求：期望先回答、只给一个候选、只问一次、不调用 `list_bundles`；
4. 选「暂不安装」→ 无安装、无二次推销；选「安装」→ 出现授权/审批 → 安装成功 → 结果中的 `bundle`/`version` 与候选一致；
5. 负例：无索引源、部分索引不可达、不兼容版本、无关查询、引用他人需求、`plugin_market`/`plugin_manager` 缺失；
6. 记录未验证项，尤其是第三方索引的真实网络行为与构建脚本审批。

## 8. 可能的 v2

- 增加一个跨索引检索工具：一次完成多索引 fan-out、去重、兼容性过滤和版本选择，减少模型手工编排；
- 增加卡片种类 `install_market_plugin` + 客户端正文包（按钮、版本、来源索引、结果重试），并实现 `reconcile` 对安装状态；
- 与个性化推荐合并：内置插件优先，其次市场条目；
- 支持从市场更新/卸载，以及在插件详情中展示市场条目页面。
