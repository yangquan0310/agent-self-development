/**
 * Hook — Hook 文件管理
 * 按照 OpenClaw 官方 Hook 规范，在 ~/.agent/hooks/ 下创建标准 Hook 目录结构
 * 实际事件处理仍由 Plugin 的 api.on() 负责，Hook 文件用于备案与 CLI 发现
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// v4.2.0: 使用 os.homedir() 替代硬编码 /root/.agent，支持 OPENCLAW_AGENT_DIR 环境变量覆盖
const DEFAULT_HOOKS_DIR = process.env.OPENCLAW_AGENT_DIR
  ? join(process.env.OPENCLAW_AGENT_DIR, 'hooks')
  : join(homedir(), '.agent', 'hooks');

const HOOK_MD_TEMPLATE = `---
name: agent-self-development
description: "Agent self-development plugin hooks: metacognition, working memory, and personality lifecycle events"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events":
          [
            "before_prompt_build",
            "llm_output",
            "agent_end",
            "before_tool_call",
            "after_tool_call",
          ],
      },
  }
---

# Agent Self-Development Hook

This hook is managed by the 'agent-self-development' plugin.
Actual event handlers run inside the plugin via 'api.on()'.
This file exists for discovery and documentation purposes.

## Events

- before_prompt_build: inject planning / monitoring skill
- llm_output: monitor deviation from plan
- agent_end: aggregate events, archive sessions, trigger personality update
- before_tool_call: record session spawn
- after_tool_call: record tool result / session completion
`;

const HANDLER_TS_TEMPLATE = `
// Agent Self-Development Hook Handler
// NOTE: This hook is managed by the plugin. Actual logic runs inside the plugin.
// This file is a placeholder for OpenClaw hook discovery.

import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  // Plugin-managed hook — no standalone logic here.
  // See agent-self-development plugin for actual implementation.
  console.log("[agent-self-development-hook] Event: " + event.type + ":" + event.action);
};

export default handler;
`;

export class Hook {
  constructor(api, options = {}) {
    this.api = api;
    this.dir = options.dir || join(DEFAULT_HOOKS_DIR, 'agent-self-development');
    this._ensureDir();
  }

  _ensureDir() {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  /**
   * 初始化 Hook 目录：写入 HOOK.md 和 handler.ts
   */
  async init() {
    this._writeFile('HOOK.md', HOOK_MD_TEMPLATE.trim());
    this._writeFile('handler.ts', HANDLER_TS_TEMPLATE.trim());
    return { hookDir: this.dir, files: ['HOOK.md', 'handler.ts'] };
  }

  /**
   * 更新 HOOK.md 中的事件列表
   */
  async updateEvents(events) {
    let content = HOOK_MD_TEMPLATE.trim();
    if (events && events.length > 0) {
      const eventsJson = JSON.stringify(events, null, 4);
      content = content.replace(
        /"events":\s*\[[\s\S]*?\]/,
        `"events": ${eventsJson}`
      );
    }
    this._writeFile('HOOK.md', content);
  }

  /**
   * 读取当前 Hook 元数据
   */
  async readMetadata() {
    const path = join(this.dir, 'HOOK.md');
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }

  _writeFile(filename, content) {
    const path = join(this.dir, filename);
    writeFileSync(path, content, 'utf8');
  }
}
