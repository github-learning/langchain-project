import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import 'dotenv/config';

/**
 * 动态测试：用 LLM 模拟 skill 执行，验证输出是否符合预期
 *
 * tests.json 格式：
 * {
 *   "model": "gpt-4o",
 *   "cases": [{
 *     "name": "测试名称",
 *     "input": "直接文本" | null,
 *     "inputFile": "相对路径" | null,
 *     "prompt": "自定义用户指令（可选）",
 *     "expect": {
 *       "reject":       true/false,       // 是否应该拒绝处理
 *       "sections":     ["章节名", ...],   // 输出应包含的 ## 章节
 *       "minSections":  6,                 // 最少章节数
 *       "hasTable":     true/false,        // 是否包含 markdown 表格
 *       "language":     "zh" | "en",       // 输出语言
 *       "contains":     ["文本1", ...],    // 输出必须包含
 *       "notContains":  ["文本1", ...],    // 输出不能包含
 *       "maxLength":    2000               // 最大字符数
 *     }
 *   }]
 * }
 */
export async function runDynamicTests({ skillContent, skillDir, testsConfig, projectRoot, model }) {
  const { ChatOpenAI } = await import('@langchain/openai');
  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

  const modelName = model || testsConfig.model || 'gpt-4o';
  console.log(chalk.dim(`   模型: ${modelName}`));

  const llm = new ChatOpenAI({
    modelName,
    temperature: 0.2,
  });

  const systemPrompt = buildSystemPrompt(skillContent);
  const results = [];

  for (const testCase of testsConfig.cases) {
    console.log('');
    console.log(chalk.bold(`  🔬 ${testCase.name}`));

    try {
      const input = resolveInput(testCase, skillDir, projectRoot);
      const userPrompt = testCase.prompt || `请对以下内容做处理:\n\n${input}`;

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const output = response.content;
      const caseResults = validateOutput(output, testCase.expect, testCase.name);
      results.push(...caseResults);

      for (const r of caseResults) {
        const icon = r.status === 'pass' ? chalk.green('    ✅') :
                     r.status === 'fail' ? chalk.red('    ❌') :
                     chalk.yellow('    ⚠️ ');
        console.log(`${icon} ${r.message}`);
      }
    } catch (err) {
      const r = { name: testCase.name, status: 'fail', message: `执行异常: ${err.message}` };
      results.push(r);
      console.log(chalk.red(`    ❌ ${r.message}`));
    }
  }

  return results;
}

function buildSystemPrompt(skillContent) {
  return `You are an AI assistant. The following skill has been activated. Follow the instructions in the skill to complete the user's request.

--- SKILL START ---
${skillContent}
--- SKILL END ---

Follow the skill instructions precisely. If the skill defines an output format, use it exactly.`;
}

function resolveInput(testCase, skillDir, projectRoot) {
  if (testCase.input) return testCase.input;
  if (testCase.inputFile) {
    const candidates = [
      resolve(projectRoot, testCase.inputFile),
      resolve(skillDir, testCase.inputFile),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return readFileSync(p, 'utf-8');
    }
    throw new Error(`找不到测试输入文件: ${testCase.inputFile}`);
  }
  throw new Error('测试用例缺少 input 或 inputFile');
}

// ── 验证器 ──────────────────────────────────────────

function validateOutput(output, expect, caseName) {
  if (!expect) return [{ name: caseName, status: 'pass', message: '无校验规则，仅检查可执行性' }];

  const results = [];

  if (expect.reject === true) {
    const isShort = output.length < 200;
    const hasRejectSignal = /补充|不足|无法|insufficient|too short|more info/i.test(output);
    if (isShort || hasRejectSignal) {
      results.push(pass(caseName, '正确拒绝处理'));
    } else {
      results.push(fail(caseName, `应拒绝处理但生成了 ${output.length} 字符的输出`));
    }
    return results;
  }

  if (expect.reject === false) {
    if (output.length < 50) {
      results.push(fail(caseName, `输出过短 (${output.length} 字符)，可能未正确处理`));
      return results;
    }
  }

  if (expect.sections) {
    for (const section of expect.sections) {
      const regex = new RegExp(`^##\\s+${escapeRegex(section)}`, 'mi');
      if (regex.test(output)) {
        results.push(pass(caseName, `包含章节「${section}」`));
      } else {
        results.push(fail(caseName, `缺少章节「${section}」`));
      }
    }
  }

  if (expect.minSections) {
    const sectionCount = (output.match(/^## .+$/gm) || []).length;
    if (sectionCount >= expect.minSections) {
      results.push(pass(caseName, `章节数 ${sectionCount} ≥ ${expect.minSections}`));
    } else {
      results.push(fail(caseName, `章节数 ${sectionCount} < ${expect.minSections}`));
    }
  }

  if (expect.hasTable === true) {
    if (/\|.*\|.*\|/.test(output) && /[-:]+\s*\|/.test(output)) {
      results.push(pass(caseName, '包含 Markdown 表格'));
    } else {
      results.push(fail(caseName, '未找到 Markdown 表格'));
    }
  }

  if (expect.language) {
    const lang = detectLanguage(output);
    if (lang === expect.language) {
      results.push(pass(caseName, `输出语言: ${lang}`));
    } else {
      results.push(fail(caseName, `期望语言 ${expect.language}，实际检测为 ${lang}`));
    }
  }

  if (expect.contains) {
    for (const text of expect.contains) {
      if (output.includes(text)) {
        results.push(pass(caseName, `包含「${text}」`));
      } else {
        results.push(fail(caseName, `未找到「${text}」`));
      }
    }
  }

  if (expect.notContains) {
    for (const text of expect.notContains) {
      if (!output.includes(text)) {
        results.push(pass(caseName, `不包含「${text}」`));
      } else {
        results.push(fail(caseName, `不应包含「${text}」但出现了`));
      }
    }
  }

  if (expect.maxLength && output.length > expect.maxLength) {
    results.push(fail(caseName, `输出 ${output.length} 字符，超过上限 ${expect.maxLength}`));
  }

  if (results.length === 0) {
    results.push(pass(caseName, '通过（无具体校验规则）'));
  }

  return results;
}

function detectLanguage(text) {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const total = text.replace(/\s+/g, '').length;
  return chinese / total > 0.15 ? 'zh' : 'en';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pass(name, message) { return { name, status: 'pass', message }; }
function fail(name, message) { return { name, status: 'fail', message }; }
