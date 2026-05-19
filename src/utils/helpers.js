/**
 * Helper Utils — v4.3.0
 *
 * 时间戳、ID 生成、模板渲染、Plan 生成。
 */

import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getNow() {
  return new Date().toISOString();
}

export function generateRunId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export function inferSessionType(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('项目') || p.includes('project') || p.includes('开发') || p.includes('代码') || p.includes('code')) return 'PROJECT';
  if (p.includes('研究') || p.includes('调研') || p.includes('文献') || p.includes('research')) return 'RESEARCH';
  if (p.includes('写作') || p.includes('撰写') || p.includes('报告') || p.includes('论文')) return 'WRITING';
  return 'TASK';
}

export function inferTaskFamily(purpose) {
  const p = (purpose || '').toLowerCase();
  if (p.includes('代码') || p.includes('开发') || p.includes('实现') || p.includes('编程') || p.includes('重构')) return 'CODE';
  if (p.includes('检索') || p.includes('搜索') || p.includes('调研') || p.includes('文献') || p.includes('收集')) return 'RESEARCH';
  if (p.includes('分析') || p.includes('统计') || p.includes('数据') || p.includes('建模')) return 'ANALYSIS';
  if (p.includes('写作') || p.includes('撰写') || p.includes('报告') || p.includes('文档') || p.includes('大纲')) return 'WRITING';
  if (p.includes('测试') || p.includes('验证') || p.includes('调试') || p.includes('审查')) return 'TEST';
  if (p.includes('设计') || p.includes('架构') || p.includes('规划') || p.includes('方案')) return 'DESIGN';
  return 'TASK';
}

function defaultPhases() {
  return [
    { id: 'p1', name: '目标理解', goal: '理解任务目标和约束条件', outputs: ['目标确认'], status: 'pending', tools: [], skills: [] },
    { id: 'p2', name: '任务分解', goal: '分解任务为可执行的子步骤', outputs: ['任务清单'], status: 'pending', tools: [], skills: [] },
    { id: 'p3', name: '分步执行', goal: '按优先级执行各子步骤', outputs: ['中间成果'], status: 'pending', tools: [], skills: [] },
    { id: 'p4', name: '质量检查', goal: '检查中间结果质量', outputs: ['检查记录'], status: 'pending', tools: [], skills: [] },
    { id: 'p5', name: '成果整合', goal: '整合输出并验证完整性', outputs: ['最终成果'], status: 'pending', tools: [], skills: [] },
    { id: 'p6', name: '任务归档', goal: '归档任务记录', outputs: ['归档记录'], status: 'pending', tools: [], skills: [] }
  ];
}

export function generatePlan(prompt) {
  const p = (prompt || '').toLowerCase();

  if (p.includes('代码') || p.includes('开发') || p.includes('实现')) {
    return {
      context: {
        goal: '实现一个可运行的软件功能',
        constraints: ['遵循项目代码规范', '包含错误处理', '包含测试用例'],
        successCriteria: ['代码可编译/运行', '测试通过', '核心逻辑文档化']
      },
      workspace: {
        artifacts: [],
        tools: ['editor', 'git', 'test_framework', 'debugger'],
        skills: []
      },
      execution: {
        phases: [
          { id: 'p1', name: '需求分析', goal: '明确接口和依赖', outputs: ['需求说明'], status: 'pending', tools: [], skills: [] },
          { id: 'p2', name: '架构设计', goal: '设计数据结构和算法', outputs: ['设计文档'], status: 'pending', tools: [], skills: [] },
          { id: 'p3', name: '核心编码', goal: '编写核心逻辑代码', outputs: ['源码文件'], status: 'pending', tools: [], skills: [] },
          { id: 'p4', name: '错误处理', goal: '添加错误处理和边界情况', outputs: ['鲁棒性增强'], status: 'pending', tools: [], skills: [] },
          { id: 'p5', name: '测试验证', goal: '编写测试用例并验证', outputs: ['测试报告'], status: 'pending', tools: [], skills: [] },
          { id: 'p6', name: '审查重构', goal: '代码审查和重构', outputs: ['审查记录'], status: 'pending', tools: [], skills: [] }
        ],
        currentPhase: 0
      }
    };
  }

  if (p.includes('写作') || p.includes('撰写') || p.includes('报告')) {
    return {
      context: {
        goal: '产出结构清晰、论证充分的文档',
        constraints: ['符合格式规范', '引用来源可靠', '语言准确'],
        successCriteria: ['大纲完整', '论点有据', '语言通顺', '格式正确']
      },
      workspace: {
        artifacts: [],
        tools: ['editor', 'research_tools', 'citation_manager'],
        skills: []
      },
      execution: {
        phases: [
          { id: 'p1', name: '素材收集', goal: '收集素材和背景信息', outputs: ['素材库'], status: 'pending', tools: [], skills: [] },
          { id: 'p2', name: '结构确定', goal: '确定文章结构和核心论点', outputs: ['大纲'], status: 'pending', tools: [], skills: [] },
          { id: 'p3', name: '正文撰写', goal: '撰写大纲和关键段落', outputs: ['初稿'], status: 'pending', tools: [], skills: [] },
          { id: 'p4', name: '细节补充', goal: '补充细节和数据支撑', outputs: ['充实稿'], status: 'pending', tools: [], skills: [] },
          { id: 'p5', name: '审校润色', goal: '审校语言、逻辑和格式', outputs: ['审校记录'], status: 'pending', tools: [], skills: [] },
          { id: 'p6', name: '输出终稿', goal: '输出终稿', outputs: ['终稿'], status: 'pending', tools: [], skills: [] }
        ],
        currentPhase: 0
      }
    };
  }

  if (p.includes('分析') || p.includes('研究') || p.includes('调查')) {
    return {
      context: {
        goal: '通过系统分析得出可靠结论',
        constraints: ['数据来源可靠', '方法可复现', '结论有依据'],
        successCriteria: ['分析框架清晰', '数据完整', '结论可靠', '报告规范']
      },
      workspace: {
        artifacts: [],
        tools: ['data_tools', 'visualization', 'research_tools'],
        skills: []
      },
      execution: {
        phases: [
          { id: 'p1', name: '目标界定', goal: '明确分析目标和范围', outputs: ['分析目标'], status: 'pending', tools: [], skills: [] },
          { id: 'p2', name: '数据收集', goal: '收集相关数据和信息', outputs: ['数据集'], status: 'pending', tools: [], skills: [] },
          { id: 'p3', name: '框架建立', goal: '建立分析框架', outputs: ['分析模型'], status: 'pending', tools: [], skills: [] },
          { id: 'p4', name: '分析执行', goal: '执行分析并记录发现', outputs: ['分析结果'], status: 'pending', tools: [], skills: [] },
          { id: 'p5', name: '结论验证', goal: '验证结论的可靠性', outputs: ['验证报告'], status: 'pending', tools: [], skills: [] },
          { id: 'p6', name: '报告形成', goal: '形成分析报告', outputs: ['分析报告'], status: 'pending', tools: [], skills: [] }
        ],
        currentPhase: 0
      }
    };
  }

  return {
    context: {
      goal: '按质量要求完成指定任务',
      constraints: ['按时完成', '符合基本要求'],
      successCriteria: ['任务完成', '结果可验收']
    },
    workspace: {
      artifacts: [],
      tools: [],
      skills: []
    },
    execution: {
      phases: defaultPhases(),
      currentPhase: 0
    }
  };
}

/**
 * 简单模板渲染：替换 {{key}} 占位符
 */
export function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}


