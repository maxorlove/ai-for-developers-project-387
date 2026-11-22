"""Count interactive model steps already started for this PR, including reruns."""
import json
import os
import subprocess


def pages(path):
    output = subprocess.check_output(["gh", "api", "--paginate", "--slurp", path])
    return json.loads(output)


repo = "repos/" + os.environ["GITHUB_REPOSITORY"]
title = "OpenCode #" + os.environ["PR_NUMBER"]
current = (int(os.environ["GITHUB_RUN_ID"]), int(os.environ["GITHUB_RUN_ATTEMPT"]))
used = 0
for page in pages(f"{repo}/actions/workflows/opencode.yml/runs?per_page=100"):
    for run in page["workflow_runs"]:
        if run["display_title"] != title:
            continue
        for attempt in range(1, run["run_attempt"] + 1):
            if (run["id"], attempt) == current:
                continue
            path = f"{repo}/actions/runs/{run['id']}/attempts/{attempt}/jobs?per_page=100"
            for batch in pages(path):
                for job in batch["jobs"]:
                    used += sum(step["name"] == "Run OpenCode" and
                                step.get("started_at") is not None and
                                step["conclusion"] != "skipped"
                                for step in job.get("steps", []))

print(f"Prior interactive calls for {title}: {used}/2")
with open(os.environ["GITHUB_OUTPUT"], "a") as outputs:
    print("admitted=" + str(used < 2).lower(), file=outputs)
