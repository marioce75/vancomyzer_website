import os
import subprocess
from pathlib import Path
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

def load_env(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line or line.startswith("export "):
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

load_env()
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

if not TOKEN:
    raise RuntimeError("Missing TELEGRAM_BOT_TOKEN in environment or .env file")

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout if result.stdout else result.stderr
    return output[:4000] if output else "No output."

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "/help - show commands\n"
        "/status - show task runner status\n"
        "/report - show git status\n"
        "/run <task_file> - set a task to in_progress\n"
        "/run_next - start the next queued task\n"
        "/agents - show current active/review-ready task snapshot\n"
        "/next_task - show next queued task\n"
        "/queue - show key Phase 1 execution queue\n"
        "/main <message> - send a command to the main agent controller\n"
        "/website_status - show website/project build progress\n"
        "/deploy_status - show deployment status"
    )

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        run_cmd(["python3", "runner/task_runner.py", "list"])
    )

async def report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        run_cmd(["git", "status"])
    )

async def run_task(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Usage: /run <task_file>")
        return
    task = context.args[0]
    await update.message.reply_text(
        run_cmd([
            "python3", "runner/task_runner.py", "set",
            task, "in_progress", "Started from Telegram"
        ])
    )

async def run_next(update: Update, context: ContextTypes.DEFAULT_TYPE):
    output = run_cmd(["python3", "agents/main/main_agent_controller.py", "run_next"])
    await update.message.reply_text(output)

async def agents(update: Update, context: ContextTypes.DEFAULT_TYPE):
    script = r'''
import json
from pathlib import Path

state_file = Path("logs/state/task_status.json")
if not state_file.exists():
    print("No task state found.")
    raise SystemExit

state = json.loads(state_file.read_text(encoding="utf-8"))
interesting = []
for name, item in sorted(state.items()):
    if item.get("status") in {"in_progress", "review_ready", "assigned"}:
        interesting.append(
            f"{name} | {item.get('status')} | {item.get('title', '')}"
        )

if interesting:
    print("\n".join(interesting[:40]))
else:
    print("No assigned, in_progress, or review_ready tasks.")
'''
    await update.message.reply_text(run_cmd(["python3", "-c", script]))

async def next_task(update: Update, context: ContextTypes.DEFAULT_TYPE):
    output = run_cmd(["python3", "runner/task_runner.py", "next"])
    await update.message.reply_text(output)

async def queue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    queue_file = Path("reports/execution/VANCOMYZER_PHASE1_EXECUTION_QUEUE.md")
    if not queue_file.exists():
        await update.message.reply_text("Phase 1 execution queue file not found.")
        return
    text = queue_file.read_text(encoding="utf-8")
    await update.message.reply_text(text[:4000])

async def main_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Usage: /main <message>")
        return
    message = " ".join(context.args)
    output = run_cmd(["python3", "agents/main/main_agent_controller.py", message])
    await update.message.reply_text(output)

async def website_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    output = run_cmd(["python3", "agents/main/main_agent_controller.py", "website"])
    await update.message.reply_text(output)

async def deploy_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    output = run_cmd(["python3", "agents/main/main_agent_controller.py", "deploy"])
    await update.message.reply_text(output)

app = ApplicationBuilder().token(TOKEN).build()

app.add_handler(CommandHandler("help", help_cmd))
app.add_handler(CommandHandler("status", status))
app.add_handler(CommandHandler("report", report))
app.add_handler(CommandHandler("run", run_task))
app.add_handler(CommandHandler("run_next", run_next))
app.add_handler(CommandHandler("agents", agents))
app.add_handler(CommandHandler("next_task", next_task))
app.add_handler(CommandHandler("queue", queue))
app.add_handler(CommandHandler("main", main_cmd))
app.add_handler(CommandHandler("website_status", website_status))
app.add_handler(CommandHandler("deploy_status", deploy_status))

if __name__ == "__main__":
    app.run_polling()
