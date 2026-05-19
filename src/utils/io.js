/**
 * IO Utils — v4.3.0
 *
 * 直接文件读写，无对象中间层。
 */

import { readFile, writeFile, mkdir, access, rename } from 'fs/promises';
import { dirname } from 'path';

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 JSON 文件
 */
export async function readJson(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 原子写入：先写临时文件，再 rename 覆盖目标文件
 */
async function atomicWrite(filePath, content) {
  await ensureDir(dirname(filePath));
  const tempPath = filePath + '.tmp';
  await writeFile(tempPath, content, 'utf-8');
  await rename(tempPath, filePath);
}

/**
 * 写入 JSON 文件（原子写）
 */
export async function writeJson(filePath, data) {
  await atomicWrite(filePath, JSON.stringify(data, null, 2));
}

/**
 * 写入 Markdown 文件（原子写）
 */
export async function writeMarkdown(filePath, content) {
  await atomicWrite(filePath, content);
}

/**
 * 读取文本文件
 */
export async function readText(filePath) {
  return readFile(filePath, 'utf-8');
}

/**
 * 移动文件（确保目标目录存在）
 */
export async function moveFile(src, dest) {
  await ensureDir(dirname(dest));
  await rename(src, dest);
}
