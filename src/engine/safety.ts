import { managedRunCode } from "#engine/shared.js";

type InjectionFinding = {
  pattern: string;
  severity: "medium" | "high";
  visible: boolean;
  text: string;
};

const PATTERNS = [
  {
    pattern: "system_prompt",
    severity: "high" as const,
    source:
      "(?:you\\s+are|act\\s+as|pretend\\s+to\\s+be|new\\s+instructions?:|ignore\\s+previous\\s+instructions?)",
  },
  {
    pattern: "tool_exfiltration",
    severity: "high" as const,
    source:
      "(?:copy\\s+the\\s+secret|print\\s+the\\s+token|reveal\\s+credentials|send\\s+your\\s+api\\s+key)",
  },
  {
    pattern: "workflow_override",
    severity: "medium" as const,
    source: "(?:do\\s+not\\s+use\\s+the\\s+browser|skip\\s+verification|ignore\\s+the\\s+user)",
  },
];

export async function managedCheckInjection(options: {
  sessionName?: string;
  includeHidden?: boolean;
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const patterns = ${JSON.stringify(PATTERNS)};
      return await page.evaluate((config) => {
        const isVisible = (node) => {
          if (!(node instanceof HTMLElement)) return true;
          const style = window.getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden" && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
        };

        const texts = Array.from(document.querySelectorAll("*"))
          .map((node) => {
            const text = node.textContent?.trim() ?? "";
            if (!text) return null;
            const visible = isVisible(node);
            if (!config.includeHidden && !visible) return null;
            return { text: text.slice(0, 400), visible };
          })
          .filter(Boolean);

        const findings = [];
        for (const entry of texts) {
          for (const pattern of config.patterns) {
            const regex = new RegExp(pattern.source, "i");
            if (regex.test(entry.text)) {
              findings.push({
                pattern: pattern.pattern,
                severity: pattern.severity,
                visible: entry.visible,
                text: entry.text,
              });
            }
          }
        }

        return {
          count: findings.length,
          findings,
          risky: findings.some((item) => item.severity === "high"),
        };
      }, {
        includeHidden: ${options.includeHidden === true},
        patterns: ${JSON.stringify(PATTERNS)},
      });
    }`,
  });

  const data = result.data.result as {
    count: number;
    findings: InjectionFinding[];
    risky: boolean;
  };

  return {
    session: result.session,
    page: result.page,
    data,
  };
}
