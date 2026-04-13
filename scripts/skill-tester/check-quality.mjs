#!/usr/bin/env node

/**
 * Skill 质量检测工具（Node.js 版）
 * 五维评分：匹配度 / 完成度 / 容错性 / Description 精度 / Token 效率，满分 100
 *
 * 用法：
 *   node check-quality.mjs --scan-dir .agents/skills/
 *   node check-quality.mjs --skill .agents/skills/meeting-summary/
 *   node check-quality.mjs --scan-dir .agents/skills/ --format json -o report.json
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';

// ── 常量 ────────────────────────────────────────────

const EXEC_KEYWORDS = [
  '自动化', '脚本', '执行', '运行', '部署', '扫描', '生成', '创建',
  'api', '浏览器', 'automat', 'script', 'execute', 'run', 'deploy',
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

const TEXT_EXTS = new Set(['.py', '.sh', '.bash', '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.mjs', '.js', '.ts']);

function getRating(score) {
  if (score >= 90) return '⭐⭐⭐⭐⭐';
  if (score >= 75) return '⭐⭐⭐⭐';
  if (score >= 60) return '⭐⭐⭐';
  if (score >= 40) return '⭐⭐';
  return '⭐';
}

// ── 解析工具 ────────────────────────────────────────

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { meta: null, body: content };
  const parts = content.split('---');
  if (parts.length < 3) return { meta: null, body: content };

  const yamlText = parts[1].trim();
  const body = parts.slice(2).join('---').trim();
  const meta = {};
  let currentKey = null;
  let currentLines = [];

  for (const line of yamlText.split('\n')) {
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentLines.push(line.trim());
      continue;
    }
    if (currentKey) {
      meta[currentKey] = currentLines.join(' ').trim();
      currentKey = null;
      currentLines = [];
    }
    const m = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (m) {
      const key = m[1];
      const val = m[2].trim();
      if (['>', '|', '>-', '|-'].includes(val)) {
        currentKey = key;
        currentLines = [];
      } else {
        meta[key] = val;
      }
    }
  }
  if (currentKey) meta[currentKey] = currentLines.join(' ').trim();

  return { meta, body };
}

function isExecTask(description) {
  const lower = description.toLowerCase();
  let count = 0;
  for (const kw of EXEC_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) count++;
  }
  return count >= 2;
}

function countPattern(content, pattern) {
  const regex = new RegExp(pattern, 'gim');
  return (content.match(regex) || []).length;
}

function listFiles(dir) {
  const result = [];
  if (!existsSync(dir)) return result;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        result.push(...listFiles(full));
      } else if (entry.isFile()) {
        result.push(full);
      }
    }
  } catch { /* ignore */ }
  return result;
}

function listTextFiles(dir) {
  return listFiles(dir).filter((f) => {
    const ext = f.slice(f.lastIndexOf('.'));
    return TEXT_EXTS.has(ext);
  });
}

function safeRead(filePath) {
  try { return readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

// ── 五维评分 ────────────────────────────────────────

function scoreMatching(skillDir, meta, body, hasScripts) {
  const desc = meta?.description || '';
  const needsExec = isExecTask(desc);

  if (hasScripts && needsExec) return { score: 19, reason: '执行类任务且有 scripts/，方案匹配' };
  if (!hasScripts && !needsExec) return { score: 19, reason: '指导类任务且纯 Prompt，方案匹配' };
  if (hasScripts && !needsExec) return { score: 14, reason: '有 scripts/ 但任务偏指导类，略过度工程化' };
  return { score: 8, reason: '执行类任务但缺少 scripts/，方案不匹配' };
}

function scoreCompleteness(skillDir, meta, body, hasScripts) {
  let score = 0;
  const reasons = [];

  if (meta) {
    score += 5;
    reasons.push('YAML frontmatter 完整');
  } else {
    reasons.push('缺少 YAML frontmatter');
  }

  const scriptsDir = join(skillDir, 'scripts');
  if (hasScripts) {
    const scriptFiles = listFiles(scriptsDir);
    const nonEmpty = scriptFiles.filter((f) => {
      try { return statSync(f).size > 10; } catch { return false; }
    });
    if (nonEmpty.length > 0) {
      score += 5;
      reasons.push(`${nonEmpty.length} 个非空脚本文件`);
    } else {
      reasons.push('scripts/ 下文件为空或过小');
    }

    let shebangOk = 0;
    for (const f of nonEmpty) {
      const content = safeRead(f);
      if (content.startsWith('#!')) shebangOk++;
    }
    if (nonEmpty.length > 0) {
      const ratio = shebangOk / nonEmpty.length;
      const sub = Math.floor(5 * ratio);
      score += sub;
      if (sub >= 4) reasons.push('脚本有 shebang');
      else if (sub >= 2) reasons.push('部分脚本缺少 shebang');
      else reasons.push('脚本缺少 shebang');
    }
  } else {
    score += 5;
    reasons.push('纯 Prompt 型，无需脚本');
  }

  for (const d of ['references', 'templates', 'examples', 'assets', 'config']) {
    const dir = join(skillDir, d);
    if (existsSync(dir) && listFiles(dir).length > 0) {
      score += 3;
      reasons.push(`有 ${d}/ 辅助文件`);
      break;
    }
  }

  let todoCount = 0;
  for (const f of listTextFiles(skillDir)) {
    const content = safeRead(f);
    for (const line of content.split('\n')) {
      const stripped = line.trim();
      if (/["'].*\b(TODO|FIXME)\b.*["']/.test(stripped)) continue;
      if (stripped.startsWith('|') && stripped.endsWith('|')) continue;
      if (/^#\s*(TODO|FIXME|HACK|XXX)\b/i.test(stripped)) todoCount++;
      else if (/^(TODO|FIXME|HACK|XXX)\b/i.test(stripped)) todoCount++;
    }
  }
  if (todoCount > 0) {
    const deduct = Math.min(todoCount * 2, 5);
    score -= deduct;
    reasons.push(`发现 ${todoCount} 个未完成标记（扣${deduct}分）`);
  }

  return { score: clamp(score, 0, 20), reason: reasons.join('; ') };
}

function scoreErrorHandling(skillDir, meta, body, hasScripts) {
  if (!hasScripts) {
    const fullText = (body || '') + ' ' + (meta?.description || '') + ' ' + safeRead(join(skillDir, 'SKILL.md'));
    const lower = fullText.toLowerCase();
    const hits = FALLBACK_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase())).length;
    if (hits >= 3) return { score: 16, reason: `Prompt 中有 ${hits} 处容错指导` };
    if (hits >= 1) return { score: 12, reason: `Prompt 中有 ${hits} 处容错指导，建议增加` };
    return { score: 6, reason: '纯 Prompt 且无容错指导' };
  }

  const scriptsDir = join(skillDir, 'scripts');
  let totalFuncs = 0;
  let totalTry = 0;
  let shellChecks = 0;

  for (const f of listFiles(scriptsDir)) {
    const content = safeRead(f);
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
    } else if (f.endsWith('.mjs') || f.endsWith('.js') || f.endsWith('.ts')) {
      totalFuncs += countPattern(content, '(function\\s+\\w+|=>|async\\s+function)');
      totalTry += countPattern(content, '\\btry\\s*\\{');
      totalTry += countPattern(content, '\\.catch\\s*\\(');
      if (content.includes('throw new Error') || content.includes('throw error')) totalTry++;
    }
  }

  const denominator = Math.max(totalFuncs, 1);
  const coverage = totalTry / denominator;
  let score;
  let reason;

  if (coverage > 0.7) {
    score = 16 + Math.min(Math.floor(coverage * 4), 4);
    reason = `错误处理覆盖率 ${Math.round(coverage * 100)}%`;
  } else if (coverage > 0.3) {
    score = 10 + Math.floor(((coverage - 0.3) / 0.4) * 5);
    reason = `错误处理覆盖率 ${Math.round(coverage * 100)}%，建议增加`;
  } else if (coverage > 0) {
    score = 5 + Math.floor((coverage / 0.3) * 5);
    reason = `错误处理覆盖率低 ${Math.round(coverage * 100)}%`;
  } else {
    score = 3;
    reason = '未发现错误处理代码';
  }

  return { score: clamp(score, 0, 20), reason };
}

function scoreDescription(skillDir, meta, body, hasScripts) {
  const desc = meta?.description || '';
  if (!desc) return { score: 2, reason: '缺少 description 字段' };

  let score = 5;
  const reasons = ['description 存在'];

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

  const vagueHits = VAGUE_WORDS.filter((w) => desc.toLowerCase().includes(w.toLowerCase()));
  if (vagueHits.length > 0) {
    const deduct = Math.min(vagueHits.length * 2, 5);
    score -= deduct;
    reasons.push(`包含泛化词 [${vagueHits.join(', ')}]（扣${deduct}分）`);
  }

  return { score: clamp(score, 0, 20), reason: reasons.join('; ') };
}

function scoreTokenEfficiency(skillDir, meta, body, hasScripts) {
  const skillMd = join(skillDir, 'SKILL.md');
  let size;
  try { size = statSync(skillMd).size; } catch { return { score: 0, reason: 'SKILL.md 不存在' }; }

  const sizeKB = size / 1024;
  let score;
  const reasons = [];

  if (sizeKB < 2) {
    score = 20;
    reasons.push(`SKILL.md ${size}B（<2KB，极佳）`);
  } else if (sizeKB < 5) {
    score = 15 + Math.floor(((5 - sizeKB) / 3) * 4);
    reasons.push(`SKILL.md ${sizeKB.toFixed(1)}KB（2-5KB，良好）`);
  } else if (sizeKB < 8) {
    score = 10 + Math.floor(((8 - sizeKB) / 3) * 4);
    reasons.push(`SKILL.md ${sizeKB.toFixed(1)}KB（5-8KB，一般）`);
  } else if (sizeKB < 15) {
    score = 5 + Math.floor(((15 - sizeKB) / 7) * 4);
    reasons.push(`SKILL.md ${sizeKB.toFixed(1)}KB（8-15KB，偏大）`);
  } else {
    score = Math.max(0, Math.floor(4 - (sizeKB - 15) / 10));
    reasons.push(`SKILL.md ${sizeKB.toFixed(1)}KB（>15KB，过大）`);
  }

  for (const d of ['references', 'templates', 'examples', 'docs']) {
    if (existsSync(join(skillDir, d))) {
      score = Math.min(score + 3, 20);
      reasons.push('有外部参考文件（渐进式披露）');
      break;
    }
  }

  const content = safeRead(skillMd);
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

  return { score: clamp(score, 0, 20), reason: reasons.join('; ') };
}

// ── 核心评估 ────────────────────────────────────────

function evaluateSkill(skillDir) {
  const skillName = basename(skillDir);
  const skillMdPath = join(skillDir, 'SKILL.md');

  const result = { name: skillName, path: skillDir, scores: {}, total: 0, rating: '', suggestions: [] };

  if (!existsSync(skillMdPath)) {
    result.rating = '⭐';
    result.suggestions.push('缺少 SKILL.md 文件');
    for (const k of ['matching', 'completeness', 'error_handling', 'description', 'efficiency']) {
      result.scores[k] = { score: 0, reason: '无 SKILL.md' };
    }
    return result;
  }

  const content = safeRead(skillMdPath);
  const { meta, body } = parseFrontmatter(content);
  const hasScripts = existsSync(join(skillDir, 'scripts'));

  const dims = [
    ['matching', scoreMatching],
    ['completeness', scoreCompleteness],
    ['error_handling', scoreErrorHandling],
    ['description', scoreDescription],
    ['efficiency', scoreTokenEfficiency],
  ];

  let total = 0;
  for (const [key, fn] of dims) {
    const r = fn(skillDir, meta || {}, body, hasScripts);
    result.scores[key] = r;
    total += r.score;
  }

  result.total = total;
  result.rating = getRating(total);

  if (result.scores.matching.score < 15) result.suggestions.push('检查实现方案是否与任务类型匹配');
  if (result.scores.completeness.score < 15) result.suggestions.push('补全缺失文件，移除未完成标记');
  if (result.scores.error_handling.score < 15) result.suggestions.push('增加错误处理和 fallback 机制');
  if (result.scores.description.score < 15) result.suggestions.push('优化 description：确保中英文触发词覆盖，避免泛化');
  if (result.scores.efficiency.score < 15) result.suggestions.push('精简 SKILL.md，将详细内容移至 references/');

  return result;
}

function scanSkills(scanDir) {
  const results = [];
  let entries;
  try { entries = readdirSync(scanDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
  catch (e) { console.error(`❌ 无法读取目录 ${scanDir}: ${e.message}`); process.exit(1); }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = join(scanDir, entry.name);
    if (existsSync(join(full, 'SKILL.md'))) {
      try { results.push(evaluateSkill(full)); }
      catch (e) {
        results.push({
          name: entry.name, path: full, total: 0, rating: '⭐',
          scores: {}, suggestions: [`评估出错: ${e.message}`],
        });
      }
    }
  }
  return results;
}

// ── 输出格式化 ──────────────────────────────────────

function formatMarkdown(results, scanDir) {
  const now = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const lines = ['# 🔍 Skills 质量审查报告', `日期：${now}`];
  if (scanDir) lines.push(`扫描目录：\`${scanDir}\``);
  lines.push(`扫描数量：${results.length} 个`, '');

  if (results.length === 0) { lines.push('未发现任何 skill。'); return lines.join('\n'); }

  const sorted = [...results].sort((a, b) => b.total - a.total);

  lines.push('## 📊 汇总评分', '');
  lines.push('| # | Skill | 匹配 | 完成 | 容错 | 精度 | 效率 | 总分 | 评级 |');
  lines.push('|---|-------|------|------|------|------|------|------|------|');
  sorted.forEach((r, i) => {
    const s = r.scores;
    lines.push(`| ${i + 1} | ${r.name} | ${s.matching?.score ?? 0} | ${s.completeness?.score ?? 0} | ${s.error_handling?.score ?? 0} | ${s.description?.score ?? 0} | ${s.efficiency?.score ?? 0} | ${r.total} | ${r.rating} |`);
  });

  const totals = results.map((r) => r.total);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  lines.push('', '## 📈 统计');
  lines.push(`- 平均分：${avg.toFixed(1)}`);
  lines.push(`- 优秀(90+)：${totals.filter((t) => t >= 90).length} 个`);
  lines.push(`- 良好(75-89)：${totals.filter((t) => t >= 75 && t < 90).length} 个`);
  lines.push(`- 合格(60-74)：${totals.filter((t) => t >= 60 && t < 75).length} 个`);
  lines.push(`- 较差(<60)：${totals.filter((t) => t < 60).length} 个`);

  lines.push('', '## 📝 逐个评审');
  for (const r of sorted) {
    lines.push(`### ${r.name} — ${r.total}分 ${r.rating}`);
    const labels = [['matching', '匹配度'], ['completeness', '完成度'], ['error_handling', '容错性'], ['description', '精度'], ['efficiency', '效率']];
    for (const [key, label] of labels) {
      const v = r.scores[key] || { score: 0, reason: '' };
      lines.push(`- ${label} ${v.score}/20：${v.reason}`);
    }
    if (r.suggestions.length > 0) {
      lines.push(`- 💡 改进建议：${r.suggestions.join('；')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatJson(results, scanDir) {
  const totals = results.map((r) => r.total);
  return JSON.stringify({
    date: new Date().toISOString(),
    scan_dir: scanDir || null,
    count: results.length,
    stats: {
      average: totals.length ? +(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : 0,
      excellent: totals.filter((t) => t >= 90).length,
      good: totals.filter((t) => t >= 75 && t < 90).length,
      pass: totals.filter((t) => t >= 60 && t < 75).length,
      poor: totals.filter((t) => t < 60).length,
    },
    results: results.map((r) => ({
      name: r.name, path: r.path, total: r.total, rating: r.rating,
      scores: r.scores, suggestions: r.suggestions,
    })),
  }, null, 2);
}

// ── CLI ─────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let scanDir = '';
  let skillDir = '';
  let format = 'markdown';
  let output = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scan-dir' && args[i + 1]) { scanDir = args[++i]; continue; }
    if (args[i] === '--skill' && args[i + 1]) { skillDir = args[++i]; continue; }
    if (args[i] === '--format' && args[i + 1]) { format = args[++i]; continue; }
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) { output = args[++i]; continue; }
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`🔍 Skill 质量检测工具

用法：
  node check-quality.mjs --scan-dir <dir>            扫描目录下所有 skills
  node check-quality.mjs --skill <dir>               评估单个 skill
  node check-quality.mjs --scan-dir <dir> --format json -o report.json

选项：
  --scan-dir <dir>    扫描目录
  --skill <dir>       单个 skill 目录
  --format <type>     输出格式：markdown（默认）/ json
  --output, -o <file> 输出到文件（默认打印到终端）`);
      process.exit(0);
    }
  }

  if (!scanDir && !skillDir) {
    console.error('❌ 请指定 --scan-dir 或 --skill 参数，使用 --help 查看帮助');
    process.exit(1);
  }

  let results;
  if (scanDir) {
    scanDir = resolve(scanDir);
    if (!existsSync(scanDir)) { console.error(`❌ 目录不存在: ${scanDir}`); process.exit(1); }
    results = scanSkills(scanDir);
    if (results.length === 0) { console.log(`⚠️ 目录 ${scanDir} 下未发现任何 skill`); process.exit(0); }
  } else {
    skillDir = resolve(skillDir);
    if (!existsSync(skillDir)) { console.error(`❌ 目录不存在: ${skillDir}`); process.exit(1); }
    results = [evaluateSkill(skillDir)];
    scanDir = '';
  }

  const report = format === 'json' ? formatJson(results, scanDir) : formatMarkdown(results, scanDir);

  if (output) {
    const outPath = resolve(output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, report, 'utf-8');
    console.log(`✅ 报告已写入: ${outPath}`);
  } else {
    console.log(report);
  }
}

main();
