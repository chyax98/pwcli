function findSection(text: string, header: string) {
  const marker = `### ${header}\n`;
  const start = text.indexOf(marker);
  if (start === -1) {
    return '';
  }
  const next = text.indexOf('\n### ', start + marker.length);
  return text.slice(start + marker.length, next === -1 ? text.length : next).trim();
}

export function parsePageSummary(text: string) {
  const section = findSection(text, 'Page');
  if (!section) {
    return undefined;
  }

  const urlMatch = section.match(/- Page URL: (.*)/);
  const titleMatch = section.match(/- Page Title: (.*)/);

  return {
    url: urlMatch?.[1] ?? '',
    title: titleMatch?.[1] ?? '',
  };
}

export function parseSnapshotYaml(text: string) {
  const section = findSection(text, 'Snapshot');
  const codeBlock = section.match(/```yaml\n([\s\S]*?)```/);
  return codeBlock?.[1]?.trim() ?? '';
}

export function parseResultText(text: string) {
  const section = findSection(text, 'Result');
  if (!section) {
    return '';
  }
  return section.trim();
}

export function stripQuotes(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseJsonStringLiteral(value: string) {
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    if (typeof current !== 'string') {
      return current;
    }
    try {
      current = JSON.parse(current);
    } catch {
      return current;
    }
  }

  try {
    return JSON.parse(current);
  } catch {
    return current;
  }
}
