import chalk from 'chalk';

/**
 * 静态检查：不调用 LLM，纯分析 SKILL.md 文件内容
 * 返回 { name, status: 'pass'|'fail'|'warn', message }[]
 */
export function runStaticChecks(content, filePath) {
  const results = [];

  const { frontmatter, body } = parseFrontmatter(content);

  // 1. YAML frontmatter 存在性
  if (!frontmatter) {
    results.push(fail('YAML Frontmatter', '缺少 YAML frontmatter（--- ... --- 块）'));
    report(results);
    return results;
  }

  // 2. name 字段
  const name = extractField(frontmatter, 'name');
  if (!name) {
    results.push(fail('name 字段', '缺少 name 字段'));
  } else {
    const nameChecks = [];
    if (name.length > 64) nameChecks.push(`超过 64 字符 (${name.length})`);
    if (!/^[a-z0-9-]+$/.test(name)) nameChecks.push('应只包含小写字母、数字和连字符');

    if (nameChecks.length > 0) {
      results.push(fail('name 字段', `"${name}" — ${nameChecks.join('; ')}`));
    } else {
      results.push(pass('name 字段', `"${name}" (${name.length} 字符)`));
    }
  }

  // 3. description 字段
  const desc = extractField(frontmatter, 'description');
  if (!desc) {
    results.push(fail('description 字段', '缺少 description 字段'));
  } else {
    const descLen = desc.length;
    if (descLen > 1024) {
      results.push(fail('description 长度', `${descLen} 字符，超过 1024 上限`));
    } else {
      results.push(pass('description 长度', `${descLen} 字符 (≤ 1024)`));
    }

    const hasWhat = desc.length > 20;
    const hasWhen =
      /use when|用于|触发|当.*时|提到|mentions/i.test(desc);

    if (!hasWhen) {
      results.push(
        warn('description 触发词', '建议包含"Use when..."或"用户提到...时触发"等触发场景'),
      );
    } else {
      results.push(pass('description 触发词', '包含触发场景描述'));
    }

    if (hasWhat && hasWhen) {
      results.push(pass('description WHAT+WHEN', '同时包含功能描述和触发条件'));
    }
  }

  // 4. Body 检查
  if (!body || body.trim().length === 0) {
    results.push(fail('Body 内容', 'SKILL.md body 为空'));
  } else {
    const lines = body.split('\n');
    const lineCount = lines.length;

    if (lineCount > 500) {
      results.push(fail('Body 行数', `${lineCount} 行，超过 500 行上限`));
    } else if (lineCount > 400) {
      results.push(warn('Body 行数', `${lineCount} 行，接近 500 行上限`));
    } else {
      results.push(pass('Body 行数', `${lineCount} 行 (≤ 500)`));
    }

    // 5. Token 预估（粗略：中文 ~1.5 token/字，英文 ~0.75 token/word）
    const estimatedTokens = estimateTokens(body);
    if (estimatedTokens > 4000) {
      results.push(warn('Token 预估', `约 ${estimatedTokens} tokens，偏大，会占用较多上下文`));
    } else {
      results.push(pass('Token 预估', `约 ${estimatedTokens} tokens`));
    }

    // 6. 结构完整性
    const sections = extractSections(body);
    if (sections.length === 0) {
      results.push(warn('Markdown 结构', '没有发现 ## 标题，建议用标题组织内容'));
    } else {
      results.push(pass('Markdown 结构', `${sections.length} 个章节: ${sections.join(', ')}`));
    }

    // 7. 是否有代码块
    const codeBlocks = (body.match(/```/g) || []).length / 2;
    if (codeBlocks > 0) {
      results.push(pass('代码示例', `包含 ${Math.floor(codeBlocks)} 个代码块`));
    }

    // 8. 是否有约束/规则章节
    const hasConstraints = /约束|规则|constraint|rule|注意/i.test(body);
    if (!hasConstraints) {
      results.push(warn('约束章节', '建议添加约束/规则章节以限定 Agent 行为边界'));
    } else {
      results.push(pass('约束章节', '包含约束/规则相关内容'));
    }

    // 9. 是否有输出格式定义
    const hasOutputFormat = /输出格式|output format|模板|template/i.test(body);
    if (!hasOutputFormat) {
      results.push(
        warn('输出格式', '建议定义输出格式/模板以提高跨模型一致性'),
      );
    } else {
      results.push(pass('输出格式', '包含输出格式定义'));
    }
  }

  // 10. 文件夹名与 name 一致性
  if (name && filePath) {
    const dirName = filePath.split('/').slice(-2, -1)[0];
    if (dirName !== name) {
      results.push(
        warn('命名一致性', `文件夹 "${dirName}" 与 name "${name}" 不一致（不影响触发，但建议统一）`),
      );
    } else {
      results.push(pass('命名一致性', `文件夹名与 name 一致`));
    }
  }

  report(results);
  return results;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  return { frontmatter: match[1], body: match[2] };
}

function extractField(frontmatter, field) {
  // multi-line (>- or > or |) — must check before single-line
  const multiLineRegex = new RegExp(`^${field}:\\s*[>|]-?\\s*\\n((?:[ \\t]+.+\\n?)*)`, 'm');
  const mMatch = frontmatter.match(multiLineRegex);
  if (mMatch) {
    return mMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  }

  // single-line
  const singleLine = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(singleLine);
  if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');

  return '';
}

function extractSections(body) {
  const matches = body.match(/^## .+$/gm) || [];
  return matches.map((m) => m.replace(/^## /, '').trim());
}

function estimateTokens(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.round(chineseChars * 1.5 + otherChars * 0.4);
}

function pass(name, message) { return { name, status: 'pass', message }; }
function fail(name, message) { return { name, status: 'fail', message }; }
function warn(name, message) { return { name, status: 'warn', message }; }

function report(results) {
  for (const r of results) {
    const icon =
      r.status === 'pass' ? chalk.green('  ✅') :
      r.status === 'fail' ? chalk.red('  ❌') :
      chalk.yellow('  ⚠️ ');
    const label = r.status === 'fail' ? chalk.red(r.name) :
                  r.status === 'warn' ? chalk.yellow(r.name) :
                  r.name;
    console.log(`${icon} ${label}: ${chalk.dim(r.message)}`);
  }
}
