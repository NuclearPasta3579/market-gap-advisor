# 市场补缺顾问 (market-gap-advisor)

当会话中发现 DSH 缺少某项能力时，从用户配置的插件索引里查找能补上它的插件，并在安装前询问一次。它不新增工具、不新增界面，也不常驻提示词：只注册一个按需加载的 skill，检索与安装分别复用现有的 `plugin_market` 与 `plugin_manager`。

## 需要

- 会话或预设的工具列表中有 `plugin_market`（由「自定义插件索引」bundle 提供）；
- 在「插件 → 发现」里至少添加一个索引源；
- 安装需要 `plugin_manager`，每次安装会经过 danger-full-access 授权或审批；
- `ask_user_question` 可选；没有它时用普通文字提问。

## 安装

- 图形界面：插件页 → 添加插件 → 选择本地目录 `market-gap-advisor`；
- 或由具备 `plugin_manager` 的会话执行 `install_bundle`，`target` 传该目录的绝对路径。

本地目录安装会链接目录而不是复制。安装后打开新会话，skill 目录里应出现 `market-gap-advisor`。

## 使用

直接提出需求。当确实缺少能力时，agent 会先说明缺口，最多给出一个候选并询问是否安装。选择安装后，会如实报告 `applied` / `restart-required` / `failed`，并在需要时单独询问是否批准构建脚本。

## 限制

- 只负责发现、询问和安装，不负责市场详情页、更新或卸载；
- 触发取决于模型对“能力缺口”的判断，不是确定性的拦截；
- 不会调用 `plugin_manager` 的列目录动作来查安装状态，因为那也会触发授权或审批；
- 不管理索引源，不做版本豁免。

设计说明与验证状态见 [DESIGN.md](./DESIGN.md)。
