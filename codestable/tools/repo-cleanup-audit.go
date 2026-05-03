package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Finding struct {
	Path   string `json:"path"`
	Size   int64  `json:"sizeBytes"`
	Reason string `json:"reason"`
}

type ReviewGroup struct {
	Prefix     string   `json:"prefix"`
	Reason     string   `json:"reason"`
	Count      int      `json:"count"`
	Size       int64    `json:"sizeBytes"`
	Sample     []string `json:"sample"`
	Entrypoint bool     `json:"entrypointLikely"`
}

type Report struct {
	GeneratedAt           string        `json:"generatedAt"`
	Root                  string        `json:"root"`
	TrackedFileCount      int           `json:"trackedFileCount"`
	DeleteCandidateCount  int           `json:"deleteCandidateCount"`
	DeleteCandidateBytes  int64         `json:"deleteCandidateBytes"`
	DeleteCandidates      []Finding     `json:"deleteCandidates"`
	ReviewGroups          []ReviewGroup `json:"reviewGroups"`
	IgnoreRecommendations []string      `json:"ignoreRecommendations"`
	SuggestedGitRM        []string      `json:"suggestedGitRm"`
}

func main() {
	rootFlag := flag.String("root", ".", "Git 仓库根目录，或仓库内任意路径")
	writeMD := flag.String("write-md", "", "可选：写入 CodeStable Markdown 审计摘要")
	jsonOut := flag.Bool("json", false, "输出完整 JSON，供脚本消费")
	failOnCandidates := flag.Bool("fail-on-delete-candidates", false, "发现 tracked 删除候选时以非 0 退出")
	sampleLimit := flag.Int("sample", 12, "每个待审分组最多展示的样例路径数")
	flag.Parse()

	root, err := gitRoot(*rootFlag)
	if err != nil {
		exitf("find git root: %v", err)
	}

	files, err := gitTrackedFiles(root)
	if err != nil {
		exitf("list tracked files: %v", err)
	}

	report := buildReport(root, files, *sampleLimit)

	if *writeMD != "" {
		path := resolveOutputPath(root, *writeMD)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			exitf("create report dir: %v", err)
		}
		if err := os.WriteFile(path, []byte(renderMarkdown(report, true)), 0644); err != nil {
			exitf("write markdown report: %v", err)
		}
		fmt.Fprintf(os.Stderr, "wrote %s\n", path)
	}

	if *jsonOut {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(report); err != nil {
			exitf("encode json: %v", err)
		}
	} else {
		fmt.Print(renderMarkdown(report, false))
	}

	if *failOnCandidates && report.DeleteCandidateCount > 0 {
		os.Exit(2)
	}
}

func gitRoot(start string) (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	cmd.Dir = start
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func gitTrackedFiles(root string) ([]string, error) {
	cmd := exec.Command("git", "ls-files", "-z")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	parts := bytes.Split(out, []byte{0})
	files := make([]string, 0, len(parts))
	for _, part := range parts {
		if len(part) == 0 {
			continue
		}
		files = append(files, filepath.ToSlash(string(part)))
	}
	sort.Strings(files)
	return files, nil
}

func buildReport(root string, files []string, sampleLimit int) Report {
	report := Report{
		GeneratedAt:      time.Now().Format(time.RFC3339),
		Root:             root,
		TrackedFileCount: len(files),
		IgnoreRecommendations: []string{
			"scripts/test-app/.next/",
			"scripts/test-app/node_modules/",
			"scripts/tmp/",
			"scripts/eval/*.log",
			"scripts/eval/raw_results.tsv",
		},
	}

	review := map[string]*ReviewGroup{}
	for _, path := range files {
		size := fileSize(root, path)
		if reason, ok := deleteReason(path); ok {
			report.DeleteCandidates = append(report.DeleteCandidates, Finding{
				Path:   path,
				Size:   size,
				Reason: reason,
			})
			report.DeleteCandidateBytes += size
			continue
		}
		if prefix, reason, entrypoint, ok := reviewReason(path); ok {
			group := review[prefix]
			if group == nil {
				group = &ReviewGroup{
					Prefix:     prefix,
					Reason:     reason,
					Entrypoint: entrypoint,
				}
				review[prefix] = group
			}
			group.Count++
			group.Size += size
			if len(group.Sample) < sampleLimit {
				group.Sample = append(group.Sample, path)
			}
		}
	}

	report.DeleteCandidateCount = len(report.DeleteCandidates)
	if report.DeleteCandidateCount > 0 {
		report.SuggestedGitRM = suggestedGitRM(report.DeleteCandidates)
	}

	for _, group := range review {
		report.ReviewGroups = append(report.ReviewGroups, *group)
	}
	sort.Slice(report.ReviewGroups, func(i, j int) bool {
		return report.ReviewGroups[i].Prefix < report.ReviewGroups[j].Prefix
	})

	return report
}

func deleteReason(path string) (string, bool) {
	switch {
	case strings.HasPrefix(path, "scripts/test-app/.next/"):
		return "本地 fixture app 的 Next.js 构建产物，不是产品 truth", true
	case strings.HasPrefix(path, "scripts/test-app/node_modules/"):
		return "本地 fixture app 的依赖安装产物，不是产品 truth", true
	case strings.HasPrefix(path, "scripts/tmp/"):
		return "临时调查脚本，属于过程辅助文件", true
	case strings.HasPrefix(path, "scripts/eval/") && strings.HasSuffix(path, ".log"):
		return "评测运行日志，属于生成的过程输出", true
	case path == "scripts/eval/raw_results.tsv":
		return "评测原始结果表，属于生成的过程输出", true
	default:
		return "", false
	}
}

func reviewReason(path string) (prefix string, reason string, entrypoint bool, ok bool) {
	switch {
	case strings.HasPrefix(path, "scripts/e2e/"):
		return "scripts/e2e/", "辅助 dogfood E2E 面；只有与当前 command contract 和 package script 对齐才保留", true, true
	case strings.HasPrefix(path, "scripts/eval/"):
		return "scripts/eval/", "评测 harness 和历史结论；只有明确 1.0 用途、owner 和重跑入口才长期保留", true, true
	case strings.HasPrefix(path, "scripts/benchmark/"):
		return "scripts/benchmark/", "benchmark harness 和结果文档；只有继续作为 release evidence 或性能专项输入才长期保留", true, true
	default:
		return "", "", false, false
	}
}

func suggestedGitRM(findings []Finding) []string {
	seen := map[string]bool{}
	add := func(cmd string) {
		if !seen[cmd] {
			seen[cmd] = true
		}
	}

	for _, finding := range findings {
		path := finding.Path
		switch {
		case strings.HasPrefix(path, "scripts/test-app/.next/"):
			add("git rm -r -- scripts/test-app/.next")
		case strings.HasPrefix(path, "scripts/test-app/node_modules/"):
			add("git rm -r -- scripts/test-app/node_modules")
		case strings.HasPrefix(path, "scripts/tmp/"):
			add("git rm -r -- scripts/tmp")
		case strings.HasPrefix(path, "scripts/eval/") && strings.HasSuffix(path, ".log"):
			add("git rm -- scripts/eval/*.log")
		case path == "scripts/eval/raw_results.tsv":
			add("git rm -- scripts/eval/raw_results.tsv")
		}
	}

	cmds := make([]string, 0, len(seen))
	for cmd := range seen {
		cmds = append(cmds, cmd)
	}
	sort.Strings(cmds)
	return cmds
}

func renderMarkdown(report Report, full bool) string {
	var b strings.Builder
	if full {
		b.WriteString("---\n")
		b.WriteString("doc_type: audit\n")
		b.WriteString("slug: repo-cleanup-baseline\n")
		b.WriteString("status: draft\n")
		b.WriteString("created: 2026-05-04\n")
		b.WriteString("tags: [repo-cleanup, pre-1-0, generated-artifacts]\n")
		b.WriteString("related_roadmap: pre-1-0-breakthrough\n")
		b.WriteString("---\n\n")
	}

	b.WriteString("# Repo Cleanup Baseline Audit\n\n")
	b.WriteString("## 摘要\n\n")
	fmt.Fprintf(&b, "- generated_at: `%s`\n", report.GeneratedAt)
	fmt.Fprintf(&b, "- root: `%s`\n", report.Root)
	fmt.Fprintf(&b, "- tracked_file_count: `%d`\n", report.TrackedFileCount)
	fmt.Fprintf(&b, "- delete_candidate_count: `%d`\n", report.DeleteCandidateCount)
	fmt.Fprintf(&b, "- delete_candidate_size: `%s`\n\n", humanBytes(report.DeleteCandidateBytes))

	b.WriteString("## 删除候选摘要\n\n")
	if len(report.DeleteCandidates) == 0 {
		b.WriteString("当前规则下没有匹配到 tracked 生成物/过程文件删除候选。\n\n")
	} else {
		b.WriteString("| 路径/模式 | 数量 | 大小 | 原因 |\n")
		b.WriteString("|---|---:|---:|---|\n")
		for _, group := range deleteSummaryGroups(report.DeleteCandidates) {
			fmt.Fprintf(&b, "| `%s` | %d | %s | %s |\n", group.Prefix, group.Count, humanBytes(group.Size), group.Reason)
		}
		b.WriteString("\n")
	}

	b.WriteString("## 建议命令\n\n")
	if len(report.SuggestedGitRM) == 0 {
		b.WriteString("不需要执行 `git rm`。\n\n")
	} else {
		b.WriteString("```bash\n")
		for _, cmd := range report.SuggestedGitRM {
			b.WriteString(cmd)
			b.WriteString("\n")
		}
		b.WriteString("```\n\n")
	}

	b.WriteString("## .gitignore 建议\n\n")
	b.WriteString("```gitignore\n")
	for _, line := range report.IgnoreRecommendations {
		b.WriteString(line)
		b.WriteString("\n")
	}
	b.WriteString("```\n\n")

	b.WriteString("## 需要后续专项判断\n\n")
	if len(report.ReviewGroups) == 0 {
		b.WriteString("当前规则下没有匹配到待审分组。\n\n")
	} else {
		b.WriteString("| 路径 | 数量 | 大小 | 可能有入口 | 原因 |\n")
		b.WriteString("|---|---:|---:|---|---|\n")
		for _, group := range report.ReviewGroups {
			fmt.Fprintf(&b, "| `%s` | %d | %s | %t | %s |\n", group.Prefix, group.Count, humanBytes(group.Size), group.Entrypoint, group.Reason)
		}
		b.WriteString("\n")
		for _, group := range report.ReviewGroups {
			fmt.Fprintf(&b, "### `%s` 样例\n\n", group.Prefix)
			for _, path := range group.Sample {
				fmt.Fprintf(&b, "- `%s`\n", path)
			}
			b.WriteString("\n")
		}
	}

	b.WriteString("## 约束\n\n")
	b.WriteString("- 除非传入 `--write-md`，本工具只读。\n")
	b.WriteString("- 本工具不会执行 `git rm`；删除必须由 Agent 或人工显式执行。\n")
	b.WriteString("- 本工具只按稳定规则分类生成物/过程文件；待审分组仍需要产品判断。\n")

	return b.String()
}

func deleteSummaryGroups(findings []Finding) []ReviewGroup {
	groups := map[string]*ReviewGroup{}
	for _, finding := range findings {
		prefix := deleteSummaryPrefix(finding.Path)
		group := groups[prefix]
		if group == nil {
			group = &ReviewGroup{
				Prefix: prefix,
				Reason: finding.Reason,
			}
			groups[prefix] = group
		}
		group.Count++
		group.Size += finding.Size
	}

	result := make([]ReviewGroup, 0, len(groups))
	for _, group := range groups {
		result = append(result, *group)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Prefix < result[j].Prefix
	})
	return result
}

func deleteSummaryPrefix(path string) string {
	switch {
	case strings.HasPrefix(path, "scripts/test-app/.next/"):
		return "scripts/test-app/.next/"
	case strings.HasPrefix(path, "scripts/test-app/node_modules/"):
		return "scripts/test-app/node_modules/"
	case strings.HasPrefix(path, "scripts/tmp/"):
		return "scripts/tmp/"
	case strings.HasPrefix(path, "scripts/eval/") && strings.HasSuffix(path, ".log"):
		return "scripts/eval/*.log"
	case path == "scripts/eval/raw_results.tsv":
		return "scripts/eval/raw_results.tsv"
	default:
		return path
	}
}

func fileSize(root, rel string) int64 {
	info, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil || info.IsDir() {
		return 0
	}
	return info.Size()
}

func resolveOutputPath(root, path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}

func humanBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGTPE"[exp])
}

func exitf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
