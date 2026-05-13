/**
 * Template Engine — v4.2.0
 *
 * 轻量级模板引擎，支持变量插值、条件渲染、列表遍历。
 * 无外部依赖，纯文本模板零改动即可兼容。
 *
 * 语法：
 *   {{variable}}        — 变量插值（支持点路径如 task.status）
 *   {{#if var}}...{{/if}}  — 条件渲染（真值/数组非空/数字非零）
 *   {{#each list}}...{{/each}} — 列表遍历，内部用 {{this.prop}} 访问当前项
 */

function getValue(obj, path) {
  if (!path) return undefined;
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  return !!value;
}

/**
 * 渲染模板
 * @param {string} template
 * @param {object} context
 * @returns {string}
 */
export function renderTemplate(template, context = {}) {
  if (!template || typeof template !== 'string') return template || '';

  let result = template;
  let prev;

  // 循环处理，支持嵌套
  do {
    prev = result;
    result = renderOnce(result, context);
  } while (result !== prev);

  return result;
}

function renderOnce(template, context) {
  let result = template;

  // {{#if path}}...{{/if}}
  result = result.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (match, path, content) => {
    const value = getValue(context, path.trim());
    return isTruthy(value) ? content : '';
  });

  // {{#each path}}...{{/each}}
  result = result.replace(/{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g, (match, path, content) => {
    const list = getValue(context, path.trim());
    if (!Array.isArray(list) || list.length === 0) return '';
    return list.map(item => renderTemplate(content, { ...context, this: item })).join('');
  });

  // {{variable}} — 避免匹配 {{#if 和 {{#each
  result = result.replace(/{{([^#/][^}]*)}}/g, (match, path) => {
    const trimmed = path.trim();
    // 支持 {{this.prop}} 在 each 内部
    if (trimmed.startsWith('this.')) {
      const value = getValue(context.this, trimmed.slice(5));
      return value !== undefined && value !== null ? String(value) : '';
    }
    const value = getValue(context, trimmed);
    return value !== undefined && value !== null ? String(value) : '';
  });

  return result;
}
