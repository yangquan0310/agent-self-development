/**
 * Return Adapter — v4.3.0
 *
 * 统一包装 tool execute 返回值格式：
 * { content: [{ type: "text", text: JSON.stringify(result) }] }
 */

export function adaptReturn(result, options = {}) {
  const { pretty = false } = options;
  try {
    const text = pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);
    return {
      content: [{ type: 'text', text }]
    };
  } catch (err) {
    return adaptError(`结果序列化失败: ${err.message}`);
  }
}

export function adaptError(error, options = {}) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true
  };
}
