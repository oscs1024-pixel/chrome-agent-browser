// JSDoc 核心类型契约定义 —— 防 schema 与 background.js / bridge 处理静默失配
// 纯注释类型定义，零运行时代价，可在 TS/IDE 环境中提供静态类型检查与智能补全。

/**
 * @typedef {Object} BridgeHello
 * @property {'hello'} type - 握手消息标识
 * @property {'agent' | 'extension'} role - 角色标识
 * @property {number} v - 协议版本号，当前基线为 1
 * @property {string} [token] - Agent 鉴权 Token
 * @property {string} [sessionId] - Agent 会话稳定持久化 ID
 * @property {string} [client] - 客户端标示 slug（如 'claude-code'）
 * @property {string} [label] - 客户端展示名（如 'Claude Code'）
 * @property {string} [version] - 扩展或客户端版本号
 * @property {string} [extId] - 浏览器扩展 runtime ID
 * @property {string} [instanceId] - 扩展实例 ID（同实例断线重连保持）
 * @property {boolean} [headless] - 是否为 headless 无头浏览器
 * @property {boolean} [probe] - 探活标记（如 doctor 调用，不计入活跃会话）
 */

/**
 * @typedef {Object} BridgeCmd
 * @property {'cmd'} type - 命令派发标识
 * @property {string} id - 消息自增序号，如 'c1'
 * @property {string} cmd - 工具动作动词（如 'click', 'snapshot', 'navigate' 等）
 * @property {Record<string, unknown>} [params] - 动作参数
 * @property {number} [tabId] - 目标标签页 ID
 * @property {string} [sid] - 桥端盖章的会话 ID
 * @property {string} [client] - 桥端盖章的客户端标识
 * @property {string} [label] - 桥端盖章的客户端显示名
 * @property {string[]} [live] - 桥端附带的在线活跃会话名单
 * @property {number} [timeout] - 桥端命令超时时间（ms）
 * @property {string} [__k] - 桥内部分发与回执关联键
 */

/**
 * @typedef {Object} BridgeRes
 * @property {'res'} type - 回执响应标识
 * @property {string} id - 对应的请求命令 ID
 * @property {boolean} ok - 执行成败指示符
 * @property {Record<string, unknown> | string} [data] - 执行返回结果载荷
 * @property {{ code: string, message: string }} [error] - 失败时的结构化错误描述
 * @property {string} [__k] - 扩展原样回传的路由关联键
 */

/**
 * @typedef {Object} BridgeEvent
 * @property {'event'} type - 广播事件标识
 * @property {'extension_online' | 'extension_offline' | 'sessions' | 'tab_closed'} event - 事件名称
 * @property {string[]} [live] - 在线会话列表
 * @property {Record<string, unknown>} [data] - 事件数据
 */

/**
 * @typedef {Object} McpTool
 * @property {string} name - 暴露给 MCP Agent 的工具名
 * @property {string} description - 工具说明
 * @property {Object} inputSchema - 符合 JSON Schema 标准的参数描述对象
 */
