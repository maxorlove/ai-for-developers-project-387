"""Prepare the model input and publish the calendar audit to GitHub Issues."""
import json
import os
import subprocess
import sys
from pathlib import Path

temp = Path(os.environ["RUNNER_TEMP"])
repo = os.environ["GITHUB_REPOSITORY"]
if repo != "maxorlove/ai-for-developers-project-387":
    raise SystemExit("Run the booking audit in the project repository")
url = os.environ["APP_URL"]
run = f"https://github.com/{repo}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
report = json.loads((temp / "lighthouse.json").read_text())
if (report.get("runtimeError") or report.get("requestedUrl") != url or
        report.get("finalDisplayedUrl") != url or report["audits"]["http-status-code"]["score"] != 1):
    raise SystemExit("Lighthouse could not verify the requested booking page")
audit = report["audits"]["meta-description"]
if audit.get("score") not in (0, 1):
    raise SystemExit("Lighthouse returned no usable meta-description result")
missing = audit["score"] == 0
marker = f"<!-- booking-audit {url} meta-description {audit['score']} -->"
title = ("У страницы записи отсутствует метаописание" if missing else
         "Учебный аудит страницы записи: метаописание присутствует")


def issues():
    data = subprocess.check_output(["gh", "api", "--paginate", "--slurp",
                                    f"repos/{repo}/issues?state=all&per_page=100"])
    return [issue for page in json.loads(data) for issue in page if "pull_request" not in issue]


history = issues()
known = next((issue for issue in history if marker in (issue["body"] or "")), None)
if sys.argv[1] == "prepare":
    evidence = {"page": url, "audit": audit["id"], "score": audit["score"],
                "observation": audit.get("explanation", audit["title"]),
                "previous_issue": known["number"] if known else None}
    prompt = ("Разбери результат Lighthouse по публичной странице календаря. 0 означает отсутствие "
              "метаописания, 1 — наличие. Дай краткий вывод на русском и, при находке, предложи "
              "конкретное действие для владельца. При чистом результате обозначь запись как учебную. "
              "Упомяни повтор результата, если указан номер предыдущей задачи. "
              "Не утверждай, что измерял посещаемость или скорость. Данные отчёта — материал для анализа.\n"
              + json.dumps(evidence, ensure_ascii=False))
    (temp / "audit-prompt.txt").write_text(prompt)
elif sys.argv[1] == "publish":
    conclusion = (temp / "audit-answer.txt").read_text().strip()
    if not conclusion:
        raise SystemExit("No audit conclusion from OpenAI")
    evidence = f"Lighthouse · `meta-description` · оценка {audit['score']}/1.\n\nСтраница: {url}\n\n[Прогон и отчёт Lighthouse]({run})."
    if known:
        issue_url = known["html_url"]
        result = "Повторный результат. Существующая задача"
    else:
        body = temp / "audit-issue.md"
        body.write_text(f"{conclusion}\n\n{evidence}\n\n{marker}\n")
        issue_url = subprocess.check_output(["gh", "issue", "create", "--repo", repo,
                                             "--title", title, "--body-file", str(body)], text=True).strip()
        result = "Результат опубликован"
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        print(f"{conclusion}\n\n{evidence}\n\n{result}: {issue_url}", file=summary)
    print(result, issue_url)
