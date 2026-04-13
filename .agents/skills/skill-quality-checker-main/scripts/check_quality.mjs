#!/usr/bin/env node
/**
 * Skill 质量检测工具 - 自动扫描并评估 skills 质量
 * 只使用 Node.js 内置模块，无第三方依赖
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// ============================================================
// 常量定义
// ============================================================

const EXEC_KEYWORDS = [
  '自动化', '脚本', '执行', '运行', '部署', '扫描', '生成', '创建',
  'API', '浏览器', 'automat', 'script', 'execute', 'run', 'deploy',
  'scan', 'generate', 'create', 'upload', 'download', 'install',
  'fetch', 'post', 'send', 'convert', 'extract', 'build', 'compile',
];

const VAGUE_WORDS = [
  '所有', '任何', '任意', '一切', 'everything', 'anything', 'all kinds',
  'any kind', 'whatever', '全部',
];

const FALLBACK_KEYWORDS = [
  '如果失败', 'fallback', '降级', '备选', '出错时', '错误处理',
  '异常', 'if fail', 'error handling', 'retry', '重试', '回退',
];

function getRating(score) {
  if (score >= 90) return '⭐⭐⭐⭐⭐';
  if (score >= 75) return '⭐⭐⭐⭐';
  if (score >= 60) return '⭐⭐⭐';
  if (score >= 40) return '⭐⭐';
  return '⭐';
}

// ============================================================
// 解析工具
// ============================================================

function parseYamlFrontmatter(content) {
  if (!content.startsWith('---')) return [null, content];
  const parts = content.split('---');
  if (parts.length < 3) return [null, content];
  const yamlText = parts[1].trim();
  const body = parts.slice(2).join('---').trim();

  const meta = {};
  let currentKey = null;
  let currentValLines = [];

  for (const line of yamlText.split('\n')) {
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentValLines.push(line.trim());
      continue;
    }
    if (currentKey) {
      meta[currentKey] = currentValLines.join(' ').trim();
      currentKey = null;
      currentValLines = [];
    }
    const m = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (m) {
      const key = m[1];
      const val = m[2].trim();
      if (['>', '|', '>-', '|-'].includes(val)) {
        currentKey = key;
        currentValLines = [];
      } else {
        meta[key] = val;
      }
    }
  }
  if (currentKey) {
    meta[currentKey] = currentValLines.join(' ').trim();
  }
  return [meta, body];
}

function isExecTask(description) {
  const descLower = description.toLowerCase();
  const count = EXEC_KEYWORDS.filter(kw => descLower.includes(kw.toLowerCase())).length;
  return count >= 2;
}

function countPattern(content, pattern) {
  const re = new RegExp(pattern, 'gim');
  return (content.match(re) || []).length;
}

// ============================================================
// 文件工具
// ============================================================

function listFiles(directory) {
  const result = [];
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        result.push(...listFiles(full));
      } else if (entry.isFile()) {
        result.push(full);
      }
    }
  } catch {
    // ignore
  }
  return result;
}

function listAllTextFiles(skillDir) {
  const textExts = new Set(['.py', '.sh', '.bash', '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.mjs', '.js']);
  return listFiles(skillDir).filter(f => textExts.has(path.extname(f)));
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

// ============================================================
// 五维评分函数
// ============================================================

function scoreMatching(_skillDir, meta, _body, hasScripts) {
  const desc = meta.description || '';
  const reasons = [];
  const needsExec = isExecTask(desc);

  let score;
  if (hasScripts && needsExec) {
    score = 19;
    reasons.push('执行类任务且有 scripts/，方案匹配');
  } else if (!hasScripts && !needsExec) {
    score = 19;
    reasons.push('指导类任务且纯 Prompt，方案匹配');
  } else if (hasScripts && !needsExec) {
    score = 14;
    reasons.push('有 scripts/ 但任务偏指导类，略过度工程化');
  } else {
    score = 8;
    reasons.push('执行类任务但缺少 scripts/，方案不匹配');
  }

  return [Math.min(score, 20), reasons.join('; ')];
}

function scoreCompleteness(skillDir, meta, _body, hasScripts) {
  let score = 0;
  const reasons = [];

  if (meta !== null) {
    score += 5;
    reasons.push('YAML frontmatter 完整');
  } else {
    reasons.push('缺少 YAML frontmatter');
  }

  const scriptsDir = path.join(skillDir, 'scripts');
  if (hasScripts) {
    const scriptFiles = listFiles(scriptsDir);
    const nonEmpty = scriptFiles.filter(f => fileSize(f) > 10);
    if (nonEmpty.length > 0) {
      score += 5;
      reasons.push(`${nonEmpty.length} 个非空脚本文件`);
    } else {
      reasons.push('scripts/ 下文件为空或过小');
    }

    let shebangOk = 0;
    let execOk = 0;
    for (const f of nonEmpty) {
      try {
        const firstLine = readFileSafe(f)?.split('\n')[0] || '';
        if (firstLine.startsWith('#!')) shebangOk++;
        const mode = fs.statSync(f).mode;
        // S_IXUSR=0o100, S_IXGRP=0o010, S_IXOTH=0o001
        if (mode & 0o111) execOk++;
      } catch {
        // ignore
      }
    }
    if (nonEmpty.length > 0) {
      const ratio = (shebangOk + execOk) / (nonEmpty.length * 2);
      const sub = Math.floor(5 * ratio);
      score += sub;
      if (sub >= 4) reasons.push('脚本有 shebang 和可执行权限');
      else if (sub >= 2) reasons.push('部分脚本缺少 shebang 或可执行权限');
      else reasons.push('脚本缺少 shebang 和可执行权限');
    }
  } else {
    score += 5;
    reasons.push('纯 Prompt 型，无需脚本');
  }

  const refsDir = path.join(skillDir, 'references');
  if (isDir(refsDir) && listFiles(refsDir).length > 0) {
    score += 3;
    reasons.push('有 references/ 辅助文件');
  }
  for (const d of ['templates', 'examples', 'assets', 'config']) {
    if (isDir(path.join(skillDir, d))) {
      score += 1;
      reasons.push(`有 ${d}/ 目录`);
      break;
    }
  }

  let todoCount = 0;
  for (const f of listAllTextFiles(skillDir)) {
    const content = readFileSafe(f);
    if (!content) continue;
    for (const line of content.split('\n')) {
      const stripped = line.trim();
      if (/["'].*\b(TODO|FIXME)\b.*["']/.test(stripped)) continue;
      if (stripped.startsWith('|') && stripped.endsWith('|')) continue;
      if (/#\s*(TODO|FIXME|HACK|XXX)\b/i.test(stripped)) todoCount++;
      else if (/^(TODO|FIXME|HACK|XXX)\b/i.test(stripped)) todoCount++;
    }
  }
  if (todoCount > 0) {
    const deduct = Math.min(todoCount * 2, 5);
    score -= deduct;
    reasons.push(`发现 ${todoCount} 个未完成标记（扣${deduct}分）`);
  }

  return [Math.max(0, Math.min(score, 20)), reasons.join('; ')];
}

function scoreErrorHandling(skillDir, meta, body, hasScripts) {
  if (!hasScripts) {
    let fullText = (body || '') + ' ' + (meta?.description || '');
    const skillMdContent = readFileSafe(path.join(skillDir, 'SKILL.md'));
    if (skillMdContent) fullText += skillMdContent;

    const fullTextLower = fullText.toLowerCase();
    const hits = FALLBACK_KEYWORDS.filter(kw => fullTextLower.includes(kw.toLowerCase())).length;
    if (hits >= 3) return [16, `Prompt 中有 ${hits} 处容错指导`];
    if (hits >= 1) return [12, `Prompt 中有 ${hits} 处容错指导，建议增加`];
    return [6, '纯 Prompt 且无容错指导'];
  }

  const scriptsDir = path.join(skillDir, 'scripts');
  let totalFuncs = 0;
  let totalTry = 0;
  let shellChecks = 0;
  const reasons = [];

  for (const f of listFiles(scriptsDir)) {
    const content = readFileSafe(f);
    if (!content) continue;

    if (f.endsWith('.py')) {
      totalFuncs += countPattern(content, '^\\s*def\\s+');
      totalTry += countPattern(content, '^\\s*try\\s*:');
      if (content.includes('ImportError')) totalTry++;
    } else if (f.endsWith('.sh') || f.endsWith('.bash')) {
      if (content.includes('set -e')) shellChecks += 3;
      shellChecks += countPattern(content, '\\|\\|\\s');
      shellChecks += countPattern(content, 'if\\s+\\[');
      totalFuncs += Math.max(countPattern(content, '^\\s*\\w+\\s*\\(\\)\\s*\\{'), 1);
      totalTry += shellChecks;
    } else if (f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.ts')) {
      totalFuncs += countPattern(content, '\\bfunction\\s+\\w+');
      totalFuncs += countPattern(content, '=>');
      totalTry += countPattern(content, '\\btry\\s*\\{');
      totalTry += countPattern(content, '\\.catch\\(');
    }
  }

  const denominator = Math.max(totalFuncs, 1);
  const coverage = totalTry / denominator;
  let score;
  if (coverage > 0.7) {
    score = 16 + Math.min(Math.floor(coverage * 4), 4);
    reasons.push(`错误处理覆盖率 ${Math.round(coverage * 100)}%`);
  } else if (coverage > 0.3) {
    score = 10 + Math.floor((coverage - 0.3) / 0.4 * 5);
    reasons.push(`错误处理覆盖率 ${Math.round(coverage * 100)}%，建议增加`);
  } else if (coverage > 0) {
    score = 5 + Math.floor(coverage / 0.3 * 5);
    reasons.push(`错误处理覆盖率低 ${Math.round(coverage * 100)}%`);
  } else {
    score = 3;
    reasons.push('未发现错误处理代码');
  }

  return [Math.min(score, 20), reasons.join('; ')];
}

function scoreDescription(_skillDir, meta, _body, _hasScripts) {
  let score = 0;
  const reasons = [];

  const desc = meta?.description || '';
  if (!desc) return [2, '缺少 description 字段'];

  score += 5;
  reasons.push('description 存在');

  const descLen = desc.length;
  if (descLen >= 50 && descLen <= 300) {
    score += 5;
    reasons.push(`长度 ${descLen} 字符，适中`);
  } else if (descLen >= 30 && descLen < 50) {
    score += 3;
    reasons.push(`长度 ${descLen} 字符，偏短`);
  } else if (descLen > 300 && descLen <= 500) {
    score += 3;
    reasons.push(`长度 ${descLen} 字符，偏长`);
  } else if (descLen < 30) {
    score += 1;
    reasons.push(`长度仅 ${descLen} 字符，太短`);
  } else {
    score += 1;
    reasons.push(`长度 ${descLen} 字符，太长`);
  }

  if (/[\u4e00-\u9fff]{2,}/.test(desc)) {
    score += 5;
    reasons.push('包含中文关键词');
  } else {
    reasons.push('缺少中文触发词');
  }

  if (/[a-zA-Z]{3,}/.test(desc)) {
    score += 5;
    reasons.push('包含英文关键词');
  } else {
    reasons.push('缺少英文触发词');
  }

  const vagueHits = VAGUE_WORDS.filter(w => desc.toLowerCase().includes(w.toLowerCase()));
  if (vagueHits.length > 0) {
    const deduct = Math.min(vagueHits.length * 2, 5);
    score -= deduct;
    reasons.push(`包含泛化词 ${JSON.stringify(vagueHits)}（扣${deduct}分）`);
  }

  return [Math.max(0, Math.min(score, 20)), reasons.join('; ')];
}

function scoreTokenEfficiency(skillDir, meta, _body, _hasScripts) {
  const reasons = [];
  const skillMd = path.join(skillDir, 'SKILL.md');

  const size = fileSize(skillMd);
  if (size === 0 && !isFile(skillMd)) return [0, 'SKILL.md 不存在'];

  const sizeKb = size / 1024;
  let score;
  if (sizeKb < 2) {
    score = 20;
    reasons.push(`SKILL.md ${size}B（<2KB，极佳）`);
  } else if (sizeKb < 5) {
    score = 15 + Math.floor((5 - sizeKb) / 3 * 4);
    reasons.push(`SKILL.md ${sizeKb.toFixed(1)}KB（2-5KB，良好）`);
  } else if (sizeKb < 8) {
    score = 10 + Math.floor((8 - sizeKb) / 3 * 4);
    reasons.push(`SKILL.md ${sizeKb.toFixed(1)}KB（5-8KB，一般）`);
  } else if (sizeKb < 15) {
    score = 5 + Math.floor((15 - sizeKb) / 7 * 4);
    reasons.push(`SKILL.md ${sizeKb.toFixed(1)}KB（8-15KB，偏大）`);
  } else {
    score = Math.max(0, Math.floor(4 - (sizeKb - 15) / 10));
    reasons.push(`SKILL.md ${sizeKb.toFixed(1)}KB（>15KB，过大）`);
  }

  let hasExternal = false;
  for (const d of ['references', 'templates', 'examples', 'docs']) {
    if (isDir(path.join(skillDir, d))) {
      hasExternal = true;
      break;
    }
  }
  if (hasExternal) {
    score = Math.min(score + 3, 20);
    reasons.push('有外部参考文件（渐进式披露）');
  }

  const content = readFileSafe(skillMd);
  if (content) {
    const lines = content.split('\n');
    const seen = new Set();
    let dupCount = 0;
    for (const line of lines) {
      const stripped = line.trim();
      if (stripped.length > 30) {
        if (seen.has(stripped)) dupCount++;
        seen.add(stripped);
      }
    }
    if (dupCount >= 3) {
      score = Math.max(score - 3, 0);
      reasons.push(`发现 ${dupCount} 行重复内容`);
    }
  }

  return [Math.min(score, 20), reasons.join('; ')];
}

// ============================================================
// 核心评估
// ============================================================

function evaluateSkill(skillDir) {
  const skillName = path.basename(skillDir);
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  const result = {
    name: skillName,
    path: skillDir,
    scores: {},
    total: 0,
    rating: '',
    suggestions: [],
  };

  if (!isFile(skillMdPath)) {
    result.rating = '⭐';
    result.suggestions.push('缺少 SKILL.md 文件');
    result.scores = {
      matching: [0, '无 SKILL.md'],
      completeness: [0, '无 SKILL.md'],
      error_handling: [0, '无 SKILL.md'],
      description: [0, '无 SKILL.md'],
      efficiency: [0, '无 SKILL.md'],
    };
    return result;
  }

  const content = readFileSafe(skillMdPath);
  if (content === null) {
    result.suggestions.push('读取 SKILL.md 失败');
    return result;
  }

  let [meta, body] = parseYamlFrontmatter(content);
  if (meta === null) meta = {};

  const hasScripts = isDir(path.join(skillDir, 'scripts'));

  const [s1, r1] = scoreMatching(skillDir, meta, body, hasScripts);
  const [s2, r2] = scoreCompleteness(skillDir, meta, body, hasScripts);
  const [s3, r3] = scoreErrorHandling(skillDir, meta, body, hasScripts);
  const [s4, r4] = scoreDescription(skillDir, meta, body, hasScripts);
  const [s5, r5] = scoreTokenEfficiency(skillDir, meta, body, hasScripts);

  result.scores = {
    matching: [s1, r1],
    completeness: [s2, r2],
    error_handling: [s3, r3],
    description: [s4, r4],
    efficiency: [s5, r5],
  };
  result.total = s1 + s2 + s3 + s4 + s5;
  result.rating = getRating(result.total);

  if (s1 < 15) result.suggestions.push('检查实现方案是否与任务类型匹配');
  if (s2 < 15) result.suggestions.push('补全缺失文件，移除未完成标记');
  if (s3 < 15) result.suggestions.push('增加错误处理和 fallback 机制');
  if (s4 < 15) result.suggestions.push('优化 description：确保中英文触发词覆盖，避免泛化');
  if (s5 < 15) result.suggestions.push('精简 SKILL.md，将详细内容移至 references/');

  return result;
}

function scanSkills(scanDir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(scanDir).sort();
  } catch (e) {
    console.error(`❌ 无法读取目录 ${scanDir}: ${e.message}`);
    process.exit(1);
  }

  for (const entry of entries) {
    const fullPath = path.join(scanDir, entry);
    if (!isDir(fullPath) || entry.startsWith('.')) continue;
    if (!isFile(path.join(fullPath, 'SKILL.md'))) continue;

    try {
      results.push(evaluateSkill(fullPath));
    } catch (e) {
      results.push({
        name: entry,
        path: fullPath,
        total: 0,
        rating: '⭐',
        scores: {},
        suggestions: [`评估出错: ${e.message}`],
      });
    }
  }
  return results;
}

// ============================================================
// 输出格式化
// ============================================================

function formatDatetime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatMarkdown(results, scanDir = null) {
  const now = formatDatetime();
  const lines = [
    '# 🔍 Skills 质量审查报告',
    `日期：${now}`,
  ];
  if (scanDir) lines.push(`扫描目录：\`${scanDir}\``);
  lines.push(`扫描数量：${results.length} 个`);
  lines.push('');

  if (results.length === 0) {
    lines.push('未发现任何 skill。');
    return lines.join('\n');
  }

  const sorted = [...results].sort((a, b) => b.total - a.total);

  lines.push('## 📊 汇总评分');
  lines.push('');
  lines.push('| # | Skill | 匹配 | 完成 | 容错 | 精度 | 效率 | 总分 | 评级 |');
  lines.push('|---|-------|------|------|------|------|------|------|------|');
  sorted.forEach((r, i) => {
    const s = r.scores;
    const m = (s.matching || [0])[0];
    const c = (s.completeness || [0])[0];
    const e = (s.error_handling || [0])[0];
    const d = (s.description || [0])[0];
    const t = (s.efficiency || [0])[0];
    lines.push(`| ${i + 1} | ${r.name} | ${m} | ${c} | ${e} | ${d} | ${t} | ${r.total} | ${r.rating} |`);
  });

  lines.push('');
  lines.push('## 📈 统计');
  const totals = results.map(r => r.total);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const excellent = totals.filter(t => t >= 90).length;
  const good = totals.filter(t => t >= 75 && t < 90).length;
  const pass = totals.filter(t => t >= 60 && t < 75).length;
  const poor = totals.filter(t => t < 60).length;
  lines.push(`- 平均分：${avg.toFixed(1)}`);
  lines.push(`- 优秀(90+)：${excellent} 个`);
  lines.push(`- 良好(75-89)：${good} 个`);
  lines.push(`- 合格(60-74)：${pass} 个`);
  lines.push(`- 较差(<60)：${poor} 个`);

  lines.push('');
  lines.push('## 📝 逐个评审');
  for (const r of sorted) {
    lines.push(`### ${r.name} — ${r.total}分 ${r.rating}`);
    const s = r.scores;
    for (const [key, label] of [['matching', '匹配度'], ['completeness', '完成度'], ['error_handling', '容错性'], ['description', '精度'], ['efficiency', '效率']]) {
      const val = s[key] || [0, ''];
      lines.push(`- ${label} ${val[0]}/20：${val[1]}`);
    }
    if (r.suggestions.length > 0) {
      lines.push(`- 💡 改进建议：${r.suggestions.join('；')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatJson(results, scanDir = null) {
  const report = {
    date: formatDatetime(),
    scan_dir: scanDir,
    count: results.length,
    results: [],
  };

  for (const r of results) {
    const item = {
      name: r.name,
      path: r.path,
      total: r.total,
      rating: r.rating,
      scores: {},
      suggestions: r.suggestions,
    };
    for (const key of ['matching', 'completeness', 'error_handling', 'description', 'efficiency']) {
      const val = r.scores[key] || [0, ''];
      item.scores[key] = { score: val[0], reason: val[1] };
    }
    report.results.push(item);
  }

  const totals = results.map(r => r.total);
  report.stats = {
    average: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length * 10) / 10 : 0,
    excellent: totals.filter(t => t >= 90).length,
    good: totals.filter(t => t >= 75 && t < 90).length,
    pass: totals.filter(t => t >= 60 && t < 75).length,
    poor: totals.filter(t => t < 60).length,
  };
  return JSON.stringify(report, null, 2);
}

// ============================================================
// 主函数
// ============================================================

function main() {
  const { values } = parseArgs({
    options: {
      'scan-dir': { type: 'string' },
      skill: { type: 'string' },
      format: { type: 'string', default: 'markdown' },
      output: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`🔍 Skill 质量检测工具 - 自动评估 skills 质量并输出报告

用法:
  node check_quality.mjs --scan-dir <dir>     扫描目录下所有 skills
  node check_quality.mjs --skill <dir>         评估单个 skill 目录
  node check_quality.mjs --format <fmt>        输出格式: markdown | json (默认 markdown)
  node check_quality.mjs -o <file>             输出文件路径（默认打印到终端）

示例:
  node check_quality.mjs --scan-dir /root/.openclaw/skills/
  node check_quality.mjs --skill /root/.openclaw/skills/my-skill/
  node check_quality.mjs --scan-dir /root/.openclaw/skills/ --format json -o /tmp/report.json`);
    process.exit(0);
  }

  if (!values['scan-dir'] && !values.skill) {
    console.error('❌ 必须指定 --scan-dir 或 --skill 参数（使用 --help 查看帮助）');
    process.exit(1);
  }
  if (values['scan-dir'] && values.skill) {
    console.error('❌ --scan-dir 和 --skill 不能同时使用');
    process.exit(1);
  }

  let results;
  let scanDir = null;

  if (values['scan-dir']) {
    scanDir = path.resolve(values['scan-dir']);
    if (!isDir(scanDir)) {
      console.error(`❌ 目录不存在: ${scanDir}`);
      process.exit(1);
    }
    results = scanSkills(scanDir);
    if (results.length === 0) {
      console.error(`⚠️ 目录 ${scanDir} 下未发现任何 skill（含 SKILL.md 的子目录）`);
      process.exit(0);
    }
  } else {
    const skillDir = path.resolve(values.skill);
    if (!isDir(skillDir)) {
      console.error(`❌ 目录不存在: ${skillDir}`);
      process.exit(1);
    }
    results = [evaluateSkill(skillDir)];
  }

  const fmt = values.format || 'markdown';
  const output = fmt === 'json' ? formatJson(results, scanDir) : formatMarkdown(results, scanDir);

  if (values.output) {
    try {
      const outputPath = path.resolve(values.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, output, 'utf-8');
      console.log(`✅ 报告已写入: ${outputPath}`);
    } catch (e) {
      console.error(`❌ 写入失败: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.log(output);
  }
}

main();
