/**
 * Skills — Skill 加载器
 *
 * 面向对象封装：管理 skill 文件的加载和缓存。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..');

export class Skills {
  constructor(dir, log) {
    this.dir = dir || path.join(__dirname, '..', 'templates');
    this.log = log;
    this.map = {
      planning: 'planning.md',
      monitoring: 'monitoring.md',
      regulation: 'regulation.md',
      working_memory: 'working-memory.md',
      development: 'personality.md'
    };
    this.cache = new Map();
  }

  /**
   * 加载指定名称的 skill，返回 SKILL.md 的文本内容
   * @param {string} name - skill 名称
   * @returns {Promise<string>} skill 文本内容，失败返回 null
   */
  async load(name) {
    if (this.cache.has(name)) {
      if (this.log) {
        await this.log.write({
          level: 'DEBUG',
          module: 'Skills',
          message: `Cache hit: ${name}`
        });
      }
      return this.cache.get(name);
    }
    const content = await this._read(name);
    if (content) {
      this.cache.set(name, content);
      if (this.log) {
        await this.log.write({
          level: 'DEBUG',
          module: 'Skills',
          message: `Loaded and cached: ${name}`
        });
      }
    } else {
      if (this.log) {
        await this.log.write({
          level: 'ERROR',
          module: 'Skills',
          message: `Load failed: ${name}`
        });
      }
    }
    return content;
  }

  /**
   * 从磁盘读取 skill 文件
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async _read(name) {
    const filename = this.map[name];
    if (!filename) {
      console.error(`[Skills] Unregistered skill: ${name}`);
      return null;
    }
    try {
      const content = await fs.readFile(path.join(this.dir, filename), 'utf-8');
      if (!content || content.trim().length === 0) {
        console.warn(`[Skills] Empty skill file: ${name} (${filename})`);
        return null;
      }
      return content;
    } catch (err) {
      console.error(`[Skills] Read failed: ${name} (${filename}): ${err.message}`);
      return null;
    }
  }

  /**
   * 清除内存缓存
   */
  forget() {
    this.cache.clear();
  }

  /**
   * 获取所有可用的 skill 名称列表
   * @returns {string[]}
   */
  list() {
    return Object.keys(this.map);
  }
}

// 向后兼容：默认实例的便捷函数
const defaults = new Skills();

export async function load(name) {
  return defaults.load(name);
}
