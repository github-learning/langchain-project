#!/usr/bin/env node

/**
 * Skill 测试框架 CLI
 *
 * 用法：
 *   node scripts/skill-tester/index.mjs <skill-name>            # 静态 + 动态
 *   node scripts/skill-tester/index.mjs <skill-name> --static   # 仅静态检查
 *   node scripts/skill-tester/index.mjs <skill-name> --dynamic  # 仅动态测试
 *   node scripts/skill-tester/index.mjs --all                   # 测试所有 skill
 *   node scripts/skill-tester/index.mjs --all --static          # 所有 skill 静态检查
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { runStaticChecks } from './static.mjs';
import { runDynamicTests } from './dynamic.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const SKILLS_DIR = join(PROJECT_ROOT, '.agents/skills');

function parseArgs(argv) {
  const args = argv.slice(2);
  let skillName = '';
  let all = false;
  let staticOnly = false;
  let dynamicOnly = false;
  let model = '';

  for (const arg of args) {
    if (arg === '--all') all = true;
    else if (arg === '--static') staticOnly = true;
    else if (arg === '--dynamic') dynamicOnly = true;
    else if (arg.startsWith('--model=')) model = arg.split('=')[1];
    else if (!arg.startsWith('-')) skillName = arg;
  }

  return { skillName, all, staticOnly, dynamicOnly, model };
}

function discoverSkills() {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => d.name);
}

function printBanner(skillName) {
  const title = ` Skill Tester — ${skillName} `;
  console.log('');
  console.log(chalk.bgBlue.white.bold(title));
  console.log('');
}

function printSummary(results) {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;

  console.log('');
  console.log(chalk.bold('━'.repeat(50)));
  console.log(
    chalk.bold('📊 结果: ') +
      chalk.green.bold(`${passed} 通过`) +
      ' | ' +
      chalk.red.bold(`${failed} 失败`) +
      ' | ' +
      chalk.yellow.bold(`${warned} 警告`),
  );
  console.log(chalk.bold('━'.repeat(50)));

  return failed === 0;
}

async function testOneSkill({ skillName, staticOnly, dynamicOnly, model }) {
  const skillDir = join(SKILLS_DIR, skillName);
  const skillPath = join(skillDir, 'SKILL.md');

  if (!existsSync(skillPath)) {
    console.error(chalk.red(`❌ 找不到 skill: ${skillPath}`));
    return false;
  }

  printBanner(skillName);

  const skillContent = readFileSync(skillPath, 'utf-8');
  const allResults = [];

  if (!dynamicOnly) {
    console.log(chalk.cyan.bold('📋 静态检查'));
    const staticResults = runStaticChecks(skillContent, skillPath);
    allResults.push(...staticResults);
  }

  if (!staticOnly) {
    const testsPath = join(skillDir, 'tests.json');
    if (!existsSync(testsPath)) {
      console.log('');
      console.log(chalk.yellow('⚠️  未找到 tests.json，跳过动态测试'));
      console.log(chalk.dim(`   创建 ${testsPath} 以启用动态测试`));
    } else {
      console.log('');
      console.log(chalk.cyan.bold('🧪 动态测试'));
      const testsConfig = JSON.parse(readFileSync(testsPath, 'utf-8'));
      const dynamicResults = await runDynamicTests({
        skillContent,
        skillDir,
        testsConfig,
        projectRoot: PROJECT_ROOT,
        model: model || testsConfig.model || 'gpt-4o',
      });
      allResults.push(...dynamicResults);
    }
  }

  return printSummary(allResults);
}

async function main() {
  const { skillName, all, staticOnly, dynamicOnly, model } = parseArgs(process.argv);

  if (!skillName && !all) {
    console.log(`${chalk.bold('Skill 测试框架')}

${chalk.cyan('用法:')}
  node scripts/skill-tester/index.mjs ${chalk.green('<skill-name>')}              ${chalk.dim('# 完整测试')}
  node scripts/skill-tester/index.mjs ${chalk.green('<skill-name>')} --static     ${chalk.dim('# 仅静态检查')}
  node scripts/skill-tester/index.mjs ${chalk.green('<skill-name>')} --dynamic    ${chalk.dim('# 仅动态测试')}
  node scripts/skill-tester/index.mjs --all                        ${chalk.dim('# 测试所有 skill')}
  node scripts/skill-tester/index.mjs ${chalk.green('<skill-name>')} --model=xxx  ${chalk.dim('# 指定模型')}

${chalk.cyan('可用 skill:')}
  ${discoverSkills().join('\n  ') || chalk.dim('(未发现任何 skill)')}`);
    process.exit(0);
  }

  const skills = all ? discoverSkills() : [skillName];
  let allPassed = true;

  for (const name of skills) {
    const passed = await testOneSkill({ skillName: name, staticOnly, dynamicOnly, model });
    if (!passed) allPassed = false;
  }

  if (all && skills.length > 1) {
    console.log('');
    console.log(
      allPassed
        ? chalk.green.bold(`✅ 全部 ${skills.length} 个 skill 测试通过`)
        : chalk.red.bold(`❌ 部分 skill 测试未通过`),
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
