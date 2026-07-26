import { RegExpParser } from '@eslint-community/regexpp';

const parser = new RegExpParser({ ecmaVersion: 2025 });

export const FLAG_OPTIONS = [
  { id: 'g', label: 'global', description: 'Find every match instead of stopping after the first.' },
  { id: 'i', label: 'ignore case', description: 'Match uppercase and lowercase characters equally.' },
  { id: 'm', label: 'multiline', description: '^ and $ match the start and end of each line.' },
  { id: 's', label: 'dot all', description: 'Dot also matches newline characters.' },
  { id: 'u', label: 'unicode', description: 'Treat the pattern as Unicode code points.' },
  { id: 'v', label: 'unicode sets', description: 'Enable Unicode set notation and strict Unicode parsing.' },
  { id: 'y', label: 'sticky', description: 'Match only from the current lastIndex position.' },
  { id: 'd', label: 'indices', description: 'Expose start and end indices for capture groups.' },
];

const appendMapped = (output, indexMap, text, sourceStart, sourceLength) => {
  const denominator = Math.max(1, text.length - 1);
  for (let index = 0; index < text.length; index += 1) {
    output.push(text[index]);
    indexMap.push(sourceStart + Math.min(
      sourceLength - 1,
      Math.round((index / denominator) * Math.max(0, sourceLength - 1)),
    ));
  }
};

export const normalizeRegexPattern = (source) => {
  const output = [];
  const indexMap = [];
  const aliases = [];
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (!escaped && character === '[') inCharacterClass = true;
    if (!escaped && character === ']') inCharacterClass = false;

    if (!escaped && !inCharacterClass && source.startsWith('(?P<', index)) {
      const match = source.slice(index).match(/^\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/);
      if (match) {
        const normalized = `(?<${match[1]}>`;
        appendMapped(output, indexMap, normalized, index, match[0].length);
        aliases.push({
          end: index + match[0].length,
          kind: 'python-named-group',
          name: match[1],
          start: index,
        });
        index += match[0].length;
        escaped = false;
        continue;
      }
    }

    if (!escaped && !inCharacterClass && source.startsWith('(?P=', index)) {
      const match = source.slice(index).match(/^\(\?P=([A-Za-z_][A-Za-z0-9_]*)\)/);
      if (match) {
        const normalized = `\\k<${match[1]}>`;
        appendMapped(output, indexMap, normalized, index, match[0].length);
        aliases.push({
          end: index + match[0].length,
          kind: 'python-named-backreference',
          name: match[1],
          start: index,
        });
        index += match[0].length;
        escaped = false;
        continue;
      }
    }

    output.push(character);
    indexMap.push(index);
    index += 1;

    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
  }

  return {
    aliases,
    indexMap,
    pattern: output.join(''),
    source,
  };
};

const mapRangeToSource = (context, start, end) => {
  if (!context?.indexMap?.length) return { start, end };
  if (start >= context.indexMap.length) {
    return { start: context.source.length, end: context.source.length };
  }
  const mappedStart = context.indexMap[Math.max(0, start)] ?? start;
  const mappedEnd = end <= start
    ? mappedStart
    : (context.indexMap[Math.min(context.indexMap.length - 1, end - 1)] ?? end - 1) + 1;
  return { start: mappedStart, end: mappedEnd };
};

export const QUICK_REFERENCE = [
  { token: '.', title: 'Any character', detail: 'Any character except newline, unless the s flag is enabled.' },
  { token: '\\d  \\D', title: 'Digit / not digit', detail: 'A decimal digit, or anything except a decimal digit.' },
  { token: '\\w  \\W', title: 'Word / not word', detail: 'ASCII letter, digit or underscore, and its inverse.' },
  { token: '\\s  \\S', title: 'Whitespace / not whitespace', detail: 'Whitespace characters, and their inverse.' },
  { token: '[abc]', title: 'Character class', detail: 'One character from the set.' },
  { token: '[^abc]', title: 'Negated class', detail: 'One character not present in the set.' },
  { token: '[a-z]', title: 'Character range', detail: 'One character between the range endpoints.' },
  { token: '^  $', title: 'Anchors', detail: 'Start and end of input, or line with the m flag.' },
  { token: '\\b  \\B', title: 'Word boundary', detail: 'A word boundary, or a position that is not one.' },
  { token: 'a|b', title: 'Alternation', detail: 'Try the expression on the left, then the one on the right.' },
  { token: '(...)', title: 'Capturing group', detail: 'Group an expression and capture its matched text.' },
  { token: '(?<name>...)', title: 'Named group', detail: 'Capture text under a descriptive name.' },
  { token: '(?P<name>...)', title: 'Python named group alias', detail: 'Accepted by Regex Lab and normalized to native JavaScript named-group syntax.' },
  { token: '(?:...)', title: 'Non-capturing group', detail: 'Group an expression without creating a capture.' },
  { token: '(?=...)  (?!...)', title: 'Lookahead', detail: 'Require or forbid a following expression without consuming it.' },
  { token: '(?<=...)  (?<!...)', title: 'Lookbehind', detail: 'Require or forbid a preceding expression without consuming it.' },
  { token: '\\1  \\k<name>', title: 'Backreference', detail: 'Match text captured by an earlier group.' },
  { token: '(?P=name)', title: 'Python named backreference alias', detail: 'Accepted by Regex Lab and normalized to \\k<name> for execution.' },
  { token: '*  +  ?', title: 'Quantifiers', detail: 'Repeat zero or more, one or more, or zero or one time.' },
  { token: '{n}  {n,m}', title: 'Range quantifier', detail: 'Repeat exactly n, or between n and m times.' },
  { token: '*?  +?  ??', title: 'Lazy quantifier', detail: 'Repeat as few times as possible.' },
  { token: '\\p{…}  \\P{…}', title: 'Unicode property', detail: 'Match characters by Unicode property; requires u or v.' },
];

const describeCharacter = (node) => {
  const character = String.fromCodePoint(node.value);
  if (node.raw.startsWith('\\')) {
    return `escaped character ${JSON.stringify(character)}`;
  }
  if (character === '\n') return 'a newline character';
  if (character === '\r') return 'a carriage return';
  if (character === '\t') return 'a tab character';
  return `the character ${JSON.stringify(character)} literally`;
};

const describeQuantifier = (node) => {
  let amount;
  if (node.min === 0 && node.max === Infinity) amount = 'zero or more times';
  else if (node.min === 1 && node.max === Infinity) amount = 'one or more times';
  else if (node.min === 0 && node.max === 1) amount = 'zero or one time';
  else if (node.min === node.max) amount = `exactly ${node.min} times`;
  else if (node.max === Infinity) amount = `${node.min} or more times`;
  else amount = `between ${node.min} and ${node.max} times`;
  return `repeat ${node.element.raw} ${amount}${node.greedy ? ' (greedy)' : ' (lazy)'}`;
};

const describeNode = (node, alternativesCount = 1) => {
  switch (node.type) {
    case 'Alternative':
      return alternativesCount > 1 ? 'an alternative branch' : 'a sequence of tokens';
    case 'Group':
      return node.modifiers
        ? 'a non-capturing group with local flag modifiers'
        : 'a non-capturing group';
    case 'CapturingGroup':
      return node.name ? `named capturing group “${node.name}”` : 'a numbered capturing group';
    case 'Quantifier':
      return describeQuantifier(node);
    case 'CharacterClass':
      return node.negate ? 'one character not in this character class' : 'one character from this character class';
    case 'CharacterClassRange':
      return `one character in the range ${node.min.raw}–${node.max.raw}`;
    case 'Character':
      return describeCharacter(node);
    case 'Backreference':
      return `the same text previously captured by ${typeof node.ref === 'number' ? `group ${node.ref}` : `“${node.ref}”`}`;
    case 'CharacterSet':
      if (node.kind === 'any') return 'any character';
      if (node.kind === 'property') {
        return `${node.negate ? 'a character outside' : 'a character in'} Unicode property ${node.key}${node.value ? `=${node.value}` : ''}`;
      }
      return `${node.negate ? 'a non-' : 'a '}${node.kind} character`;
    case 'Assertion':
      if (node.kind === 'start') return 'assert the start of the input or line';
      if (node.kind === 'end') return 'assert the end of the input or line';
      if (node.kind === 'word') return `assert ${node.negate ? 'a non-word' : 'a word'} boundary`;
      return `${node.negate ? 'negative' : 'positive'} ${node.kind} assertion`;
    case 'ExpressionCharacterClass':
      return node.negate ? 'a negated Unicode set expression' : 'a Unicode set expression';
    case 'ClassIntersection':
      return 'the intersection of two character sets';
    case 'ClassSubtraction':
      return 'a character set with another set removed';
    case 'ClassStringDisjunction':
      return 'one of several strings inside a Unicode set';
    default:
      return node.type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
};

const childrenOf = (node) => {
  switch (node.type) {
    case 'Pattern':
    case 'Group':
    case 'CapturingGroup':
    case 'Assertion':
      return node.alternatives || [];
    case 'Alternative':
      return node.elements || [];
    case 'CharacterClass':
      return node.elements || [];
    case 'CharacterClassRange':
      return [node.min, node.max];
    case 'ExpressionCharacterClass':
      return [node.expression];
    case 'ClassIntersection':
    case 'ClassSubtraction':
      return [node.left, node.right];
    case 'ClassStringDisjunction':
      return node.alternatives || [];
    case 'StringAlternative':
      return node.elements || [];
    default:
      return [];
  }
};

export const parseRegexPattern = (pattern, flags) => {
  const normalized = normalizeRegexPattern(pattern);
  try {
    const ast = parser.parsePattern(
      normalized.pattern,
      0,
      normalized.pattern.length,
      {
        unicode: flags.includes('u'),
        unicodeSets: flags.includes('v'),
      },
    );

    // The browser is the source of truth for the selected JavaScript flavor.
    // regexpp supplies the AST and better source ranges.
    new RegExp(normalized.pattern, flags);
    return { ...normalized, ast };
  } catch (error) {
    if (Number.isInteger(error.index)) {
      error.sourceIndex = mapRangeToSource(normalized, error.index, error.index).start;
    }
    throw error;
  }
};

export const buildExplanation = (ast, context = null) => {
  const rows = [];

  const visit = (node, depth) => {
    if (node.type !== 'Pattern') {
      const sourceRange = mapRangeToSource(context, node.start, node.end);
      rows.push({
        depth,
        description: describeNode(
          node,
          node.parent?.alternatives?.length || 1,
        ),
        end: sourceRange.end,
        raw: context
          ? context.source.slice(sourceRange.start, sourceRange.end)
          : node.raw,
        start: sourceRange.start,
        type: node.type,
      });
    }

    childrenOf(node).forEach((child) => {
      // A quantifier already describes its complete atom. Showing the atom
      // below it duplicates the most important explanation.
      if (node.type !== 'Quantifier') visit(child, node.type === 'Pattern' ? depth : depth + 1);
    });
  };

  visit(ast, 0);
  return rows;
};

const containsQuantifier = (node) => {
  if (!node) return false;
  if (node.type === 'Quantifier') return true;
  return childrenOf(node).some(containsQuantifier);
};

const hasOverlappingAlternativePrefix = (node) => {
  const alternatives = node?.alternatives || [];
  if (alternatives.length < 2) return false;
  const starts = alternatives
    .map((alternative) => alternative.elements?.[0]?.raw || '')
    .filter(Boolean);
  return starts.some((left, index) => starts.some(
    (right, otherIndex) => index !== otherIndex
      && (left.startsWith(right) || right.startsWith(left)),
  ));
};

export const analyzeRegexRisk = (ast, pattern, context = null) => {
  const issues = [];

  const visit = (node) => {
    if (node.type === 'Quantifier') {
      if (containsQuantifier(node.element)) {
        issues.push({
          level: 'high',
          message: `Nested repetition in ${node.raw} can cause excessive backtracking.`,
          start: node.start,
          end: node.end,
        });
      }
      if (
        (node.element.type === 'Group' || node.element.type === 'CapturingGroup')
        && hasOverlappingAlternativePrefix(node.element)
      ) {
        issues.push({
          level: 'high',
          message: `Repeated alternatives in ${node.raw} share a prefix and may backtrack exponentially.`,
          start: node.start,
          end: node.end,
        });
      }
      if (
        node.max === Infinity
        && node.element.type === 'CharacterSet'
        && node.element.kind === 'any'
      ) {
        issues.push({
          level: 'review',
          message: `Unbounded wildcard ${node.raw} may scan much more input than intended.`,
          start: node.start,
          end: node.end,
        });
      }
    }
    childrenOf(node).forEach(visit);
  };

  visit(ast);

  if (/(\.\*|\.\+).*(\.\*|\.\+)/.test(pattern)) {
    issues.push({
      level: 'review',
      message: 'Multiple unbounded wildcards can create large search spaces.',
      start: 0,
      end: pattern.length,
    });
  }

  const mappedIssues = issues.map((issue) => {
    const sourceRange = mapRangeToSource(context, issue.start, issue.end);
    return { ...issue, ...sourceRange };
  });
  const unique = mappedIssues.filter((issue, index) => mappedIssues.findIndex(
    (candidate) => candidate.message === issue.message
      && candidate.start === issue.start,
  ) === index);
  const level = unique.some((issue) => issue.level === 'high')
    ? 'high'
    : unique.length
      ? 'review'
      : 'low';

  return { level, issues: unique };
};

const escapeRegexLiteral = (pattern) => {
  let output = '';
  let consecutiveBackslashes = 0;
  for (const character of pattern) {
    if (character === '\\') {
      consecutiveBackslashes += 1;
      output += character;
      continue;
    }
    if (character === '/' && consecutiveBackslashes % 2 === 0) output += '\\';
    if (character === '\n') output += '\\n';
    else if (character === '\r') output += '\\r';
    else if (character === '\u2028') output += '\\u2028';
    else if (character === '\u2029') output += '\\u2029';
    else output += character;
    consecutiveBackslashes = 0;
  }
  return output;
};

const toPythonPattern = (pattern) => pattern
  .replace(/\(\?<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?P<$1>')
  .replace(/\\k<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?P=$1)');

const toPythonReplacement = (replacement) => replacement
  .replace(/\$<([A-Za-z_][A-Za-z0-9_]*)>/g, '\\g<$1>')
  .replace(/\$(\d+)/g, '\\g<$1>')
  .split('$&').join('\\g<0>');

const toGoPattern = (pattern) => pattern
  .replace(/\(\?<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?P<$1>');

const toGoReplacement = (replacement) => replacement
  .replace(/\$<([A-Za-z_][A-Za-z0-9_]*)>/g, (_, name) => `\${${name}}`)
  .split('$&').join('$0');

const pythonCompatibility = (pattern, flags, replacement) => {
  const warnings = [];
  if (/\\[pP]\{/.test(pattern)) warnings.push('Python re does not support JavaScript Unicode property escapes.');
  if (flags.includes('y')) warnings.push('The sticky y flag has no direct Python re equivalent.');
  if (flags.includes('v')) warnings.push('Unicode Sets v syntax is not supported by Python re.');
  if (flags.includes('d')) warnings.push('The d flag is unnecessary; Match.span() provides indices.');
  if (replacement.includes('$`') || replacement.includes("$'")) {
    warnings.push('JavaScript prefix/suffix replacement tokens have no direct Python re equivalent.');
  }
  return warnings;
};

const goCompatibility = (pattern, flags, replacement) => {
  const warnings = [];
  if (/\(\?(?:[=!]|<[=!])/.test(pattern)) warnings.push('Go regexp uses RE2 and does not support lookaround assertions.');
  if (/\\(?:[1-9]|k<)/.test(pattern)) warnings.push('Go regexp does not support backreferences.');
  if (flags.includes('y')) warnings.push('The sticky y flag has no Go regexp equivalent.');
  if (flags.includes('v')) warnings.push('JavaScript Unicode Sets v syntax is not supported by Go regexp.');
  if (flags.includes('d')) warnings.push('The d flag is unnecessary; Find*Index methods provide indices.');
  if (replacement.includes('$`') || replacement.includes("$'")) {
    warnings.push('JavaScript prefix/suffix replacement tokens have no direct Go regexp equivalent.');
  }
  return warnings;
};

const inlineGoFlags = (flags) => ['i', 'm', 's']
  .filter((flag) => flags.includes(flag))
  .join('');

export const generateRegexCode = ({ pattern, flags, testString, replacement }) => {
  const literal = `/${escapeRegexLiteral(pattern)}/${flags}`;
  const patternString = JSON.stringify(pattern);
  const flagsString = JSON.stringify(flags);
  const inputString = JSON.stringify(testString);
  const replacementString = JSON.stringify(replacement);
  const pythonPattern = toPythonPattern(pattern);
  const pythonReplacement = toPythonReplacement(replacement);
  const pythonFlags = [
    flags.includes('i') && 're.IGNORECASE',
    flags.includes('m') && 're.MULTILINE',
    flags.includes('s') && 're.DOTALL',
  ].filter(Boolean);
  const pythonCompile = `re.compile(${JSON.stringify(pythonPattern)}${
    pythonFlags.length ? `, ${pythonFlags.join(' | ')}` : ''
  })`;
  const goFlags = inlineGoFlags(flags);
  const goPattern = `${goFlags ? `(?${goFlags})` : ''}${toGoPattern(pattern)}`;
  const goPatternString = goPattern.includes('`')
    ? JSON.stringify(goPattern)
    : `\`${goPattern}\``;
  const goInputString = testString.includes('`')
    ? JSON.stringify(testString)
    : `\`${testString}\``;
  const goReplacement = toGoReplacement(replacement);
  const goReplacementString = goReplacement.includes('`')
    ? JSON.stringify(goReplacement)
    : `\`${goReplacement}\``;
  const goMatchLimit = flags.includes('g') ? '-1' : '1';

  return {
    javascript: {
      label: 'JavaScript',
      language: 'javascript',
      warnings: [],
      snippets: {
        compile: [
          `const regex = ${literal};`,
          `// Constructor form: new RegExp(${patternString}, ${flagsString})`,
        ].join('\n'),
        match: [
          `const regex = ${literal};`,
          `const input = ${inputString};`,
          '',
          flags.includes('g')
            ? 'const matches = [...input.matchAll(regex)];'
            : 'const match = regex.exec(input);',
        ].join('\n'),
        replace: [
          `const regex = ${literal};`,
          `const input = ${inputString};`,
          `const output = input.replace(regex, ${replacementString});`,
        ].join('\n'),
      },
    },
    python: {
      label: 'Python',
      language: 'python',
      warnings: pythonCompatibility(pattern, flags, replacement),
      snippets: {
        compile: [
          'import re',
          '',
          `regex = ${pythonCompile}`,
        ].join('\n'),
        match: [
          'import re',
          '',
          `regex = ${pythonCompile}`,
          `text = ${JSON.stringify(testString)}`,
          flags.includes('g')
            ? 'matches = list(regex.finditer(text))'
            : 'match = regex.search(text)',
        ].join('\n'),
        replace: [
          'import re',
          '',
          `regex = ${pythonCompile}`,
          `text = ${JSON.stringify(testString)}`,
          `output = regex.sub(${JSON.stringify(pythonReplacement)}, text, count=${flags.includes('g') ? '0' : '1'})`,
        ].join('\n'),
      },
    },
    go: {
      label: 'Go',
      language: 'go',
      warnings: goCompatibility(pattern, flags, replacement),
      snippets: {
        compile: [
          'package main',
          '',
          'import "regexp"',
          '',
          `var regex = regexp.MustCompile(${goPatternString})`,
        ].join('\n'),
        match: [
          'package main',
          '',
          'import "regexp"',
          '',
          'func main() {',
          `    regex := regexp.MustCompile(${goPatternString})`,
          `    text := ${goInputString}`,
          `    matches := regex.FindAllStringSubmatch(text, ${goMatchLimit})`,
          '    _ = matches',
          '}',
        ].join('\n'),
        replace: flags.includes('g') ? [
          'package main',
          '',
          'import "regexp"',
          '',
          'func main() {',
          `    regex := regexp.MustCompile(${goPatternString})`,
          `    text := ${goInputString}`,
          `    output := regex.ReplaceAllString(text, ${goReplacementString})`,
          '    _ = output',
          '}',
        ].join('\n') : [
          'package main',
          '',
          'import "regexp"',
          '',
          'func main() {',
          `    regex := regexp.MustCompile(${goPatternString})`,
          `    text := ${goInputString}`,
          '    output := text',
          '    if loc := regex.FindStringSubmatchIndex(text); loc != nil {',
          `        expanded := regex.ExpandString(nil, ${goReplacementString}, text, loc)`,
          '        output = text[:loc[0]] + string(expanded) + text[loc[1]:]',
          '    }',
          '    _ = output',
          '}',
        ].join('\n'),
      },
    },
  };
};

const WORKER_SOURCE = `
self.onmessage = function (event) {
  const data = event.data;
  const startedAt = performance.now();
  const response = { matches: [], tests: [], replacementOutput: '', truncated: false };
  try {
    let executionFlags = data.flags;
    try {
      new RegExp('', 'd');
      if (!executionFlags.includes('d')) executionFlags += 'd';
    } catch {}

    const regex = new RegExp(data.pattern, executionFlags);
    let match;
    let matchNumber = 0;
    const repeating = executionFlags.includes('g') || executionFlags.includes('y');

    while ((match = regex.exec(data.testString)) !== null) {
      const indices = match.indices || [];
      const start = match.index;
      const end = start + match[0].length;
      const groups = [];
      for (let index = 1; index < match.length; index += 1) {
        const range = indices[index] || null;
        groups.push({
          number: index,
          value: match[index] === undefined ? null : match[index],
          start: range ? range[0] : null,
          end: range ? range[1] : null
        });
      }
      const named = {};
      if (match.groups) {
        Object.keys(match.groups).forEach(function (name) {
          const range = match.indices && match.indices.groups
            ? match.indices.groups[name]
            : null;
          named[name] = {
            value: match.groups[name] === undefined ? null : match.groups[name],
            start: range ? range[0] : null,
            end: range ? range[1] : null
          };
        });
      }
      response.matches.push({
        number: ++matchNumber,
        start: start,
        end: end,
        value: match[0],
        groups: groups,
        named: named
      });
      if (response.matches.length >= data.maxMatches) {
        response.truncated = true;
        break;
      }
      if (!repeating) break;
      if (match[0] === '') {
        const unicode = executionFlags.includes('u') || executionFlags.includes('v');
        const next = data.testString.codePointAt(regex.lastIndex);
        regex.lastIndex += unicode && next > 0xFFFF ? 2 : 1;
      }
    }

    const replacementRegex = new RegExp(data.pattern, data.flags);
    response.replacementOutput = data.testString.replace(
      replacementRegex,
      data.replacement
    );

    response.tests = data.tests.map(function (test) {
      const testRegex = new RegExp(data.pattern, data.flags);
      const found = testRegex.test(test.input);
      return { id: test.id, found: found, passed: found === test.expected };
    });
    response.elapsedMs = performance.now() - startedAt;
    self.postMessage({ ok: true, result: response });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message || String(error) });
  }
};
`;

export const runRegexSafely = ({
  pattern,
  flags,
  testString,
  replacement,
  tests,
  maxMatches = 1000,
  timeoutMs = 400,
}) => new Promise((resolve, reject) => {
  if (typeof Worker === 'undefined') {
    reject(new Error('Web Workers are not available in this browser.'));
    return;
  }

  const blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], {
    type: 'text/javascript',
  }));
  const worker = new Worker(blobUrl);
  let settled = false;

  const finish = (callback) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    worker.terminate();
    URL.revokeObjectURL(blobUrl);
    callback();
  };

  const timeout = setTimeout(() => {
    finish(() => reject(new Error(
      `Execution exceeded ${timeoutMs} ms. The pattern may cause catastrophic backtracking.`,
    )));
  }, timeoutMs);

  worker.onmessage = (event) => {
    finish(() => {
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    });
  };
  worker.onerror = (event) => {
    finish(() => reject(new Error(event.message || 'Regex worker failed.')));
  };
  worker.postMessage({
    flags,
    maxMatches,
    pattern,
    replacement,
    testString,
    tests,
  });
});
