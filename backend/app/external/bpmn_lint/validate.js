#!/usr/bin/env node

/**
 * BPMN Validation Service
 *
 * This script validates BPMN files using bpmnlint.
 * Can be used as a CLI tool or imported as a module.
 *
 * Usage:
 *   node validate.js <file-path> [--config <path>] [--json]
 *   node validate.js --help
 */

const fs = require('fs').promises;
const path = require('path');
const { Linter } = require('bpmnlint');
const BpmnModdle = require('bpmn-moddle');
const NodeResolver = require('bpmnlint/lib/resolver/node-resolver');

// Default configuration
const DEFAULT_CONFIG = {
  extends: 'bpmnlint:recommended'
};

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    files: [],
    config: null,
    json: false,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.version = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--config' || arg === '-c') {
      parsed.config = args[++i];
    } else if (!arg.startsWith('-')) {
      parsed.files.push(arg);
    }
  }

  return parsed;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
BPMN Validation Service using bpmnlint

Usage:
  node validate.js <file-path> [options]
  node validate.js *.bpmn [options]

Options:
  --config, -c <path>    Path to .bpmnlintrc configuration file
  --json                 Output results as JSON
  --help, -h             Show this help message
  --version, -v          Show version information

Examples:
  node validate.js diagram.bpmn
  node validate.js --json diagram.bpmn
  node validate.js --config /path/to/.bpmnlintrc *.bpmn

Configuration:
  Create a .bpmnlintrc file in your working directory:
  {
    "extends": "bpmnlint:recommended"
  }

  Available configurations:
  - bpmnlint:recommended (default, best practices + compliance)
  - bpmnlint:correctness (BPMN compliance only)
  - bpmnlint:all (all rules)

Exit Codes:
  0 - All files valid
  1 - Validation errors found
  2 - Invalid arguments or file not found
  `);
}

/**
 * Show version
 */
function showVersion() {
  const pkg = require('./package.json');
  console.log(`bpmnlint-validator ${pkg.version}`);
}

/**
 * Load configuration from .bpmnlintrc or use default
 */
async function loadConfig(configPath) {
  try {
    if (configPath) {
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    }

    // Try to find .bpmnlintrc in script's directory (where validate.js is)
    const scriptDir = path.dirname(__filename);
    try {
      const configContent = await fs.readFile(path.join(scriptDir, '.bpmnlintrc'), 'utf-8');
      return JSON.parse(configContent);
    } catch {
      // Fall back to current working directory
      try {
        const configContent = await fs.readFile('.bpmnlintrc', 'utf-8');
        return JSON.parse(configContent);
      } catch {
        return DEFAULT_CONFIG;
      }
    }
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Validate a single BPMN file
 */
async function validateFile(filePath, config) {
  try {
    const xml = await fs.readFile(filePath, 'utf-8');
    const moddle = new BpmnModdle();

    const { rootElement, warnings: importWarnings = [] } = await moddle.fromXML(xml);

    const linter = new Linter({
      config,
      resolver: new NodeResolver()
    });

    const reports = await linter.lint(rootElement);

    return {
      file: filePath,
      valid: Object.values(reports).every(arr => arr.length === 0),
      reports,
      importWarnings: importWarnings.map(w => ({
        message: w.message,
        element: w.element?.id
      }))
    };
  } catch (error) {
    return {
      file: filePath,
      valid: false,
      error: error.message,
      reports: {}
    };
  }
}

/**
 * Format results for console output
 */
function formatResults(results) {
  const lines = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  results.forEach(result => {
    lines.push(`\n${result.file}`);
    lines.push('-'.repeat(result.file.length));

    if (result.error) {
      lines.push(`  ❌ Parse Error: ${result.error}`);
      totalErrors++;
      return;
    }

    if (result.importWarnings?.length) {
      result.importWarnings.forEach(w => {
        lines.push(`  ⚠️  Import Warning: ${w.message}${w.element ? ` (${w.element})` : ''}`);
        totalWarnings++;
      });
    }

    let hasIssues = false;
    Object.entries(result.reports).forEach(([ruleName, issues]) => {
      issues.forEach(issue => {
        hasIssues = true;
        const icon = issue.category === 'error' ? '❌' : '⚠️';
        const element = issue.id ? ` [${issue.id}]` : '';
        lines.push(`  ${icon} ${issue.category.toUpperCase()}: ${issue.message}${element} (${ruleName})`);

        if (issue.category === 'error') {
          totalErrors++;
        } else {
          totalWarnings++;
        }
      });
    });

    if (!hasIssues && !result.importWarnings?.length) {
      lines.push('  ✅ Valid');
    }
  });

  lines.push('\n' + '='.repeat(50));
  lines.push(`Summary: ${totalErrors} errors, ${totalWarnings} warnings`);

  return {
    output: lines.join('\n'),
    totalErrors,
    totalWarnings
  };
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    showVersion();
    process.exit(0);
  }

  if (args.files.length === 0) {
    console.error('Error: No BPMN file specified');
    showHelp();
    process.exit(2);
  }

  try {
    // Expand glob patterns
    const files = [];
    for (const file of args.files) {
      if (file.includes('*')) {
        // Simple glob expansion for *.bpmn patterns
        const dir = path.dirname(file);
        const pattern = path.basename(file);
        const entries = await fs.readdir(dir || '.');
        const matches = entries.filter(f => {
          const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
          return regex.test(f);
        });
        files.push(...matches.map(f => path.join(dir || '.', f)));
      } else {
        files.push(file);
      }
    }

    // Load configuration
    const config = await loadConfig(args.config);

    // Validate all files
    const results = await Promise.all(files.map(f => validateFile(f, config)));

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const { output } = formatResults(results);
      console.log(output);
    }

    // Compute totalErrors from results (regardless of json output)
    const totalErrors = results.reduce((sum, r) => {
      return sum + Object.values(r.reports || {}).reduce((s, arr) => s + arr.filter(i => i.category === 'error').length, 0);
    }, 0);

    process.exit(totalErrors > 0 ? 1 : 0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(2);
  }
}

// Export for use as module
module.exports = { validateFile, loadConfig };

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(2);
  });
}
