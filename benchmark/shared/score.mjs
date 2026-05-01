function round(value) {
  return Math.round(value * 100) / 100;
}

export function computeBenchmarkScore(tasks) {
  const categories = {};
  for (const task of tasks) {
    const key = task.category || "unknown";
    const bucket = categories[key] || { total: 0, passed: 0, failed: 0 };
    bucket.total += 1;
    if (task.status === "passed") {
      bucket.passed += 1;
    } else {
      bucket.failed += 1;
    }
    categories[key] = bucket;
  }

  const categoryScores = Object.fromEntries(
    Object.entries(categories).map(([key, value]) => [
      key,
      {
        ...value,
        passRate: value.total > 0 ? round((value.passed / value.total) * 100) : 0,
      },
    ]),
  );

  const total = tasks.length;
  const passed = tasks.filter((task) => task.status === "passed").length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? round((passed / total) * 100) : 0,
    categories: categoryScores,
    overallScore: total > 0 ? round((passed / total) * 100) : 0,
  };
}
