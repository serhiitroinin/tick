#!/usr/bin/env bun
import { Command } from "commander";
import { setSecret, hasSecret } from "./lib/keychain.ts";
import * as out from "./lib/output.ts";
import { importFromLuff } from "./lib/import-luff.ts";
import { readSecret } from "./lib/prompt.ts";
import { todoist } from "./providers/todoist.ts";
import type { TodoProvider, TodoTask, TodoProject } from "./types.ts";

// For now, todoist is the only provider. This is the extension point.
const provider: TodoProvider = todoist;

function priorityLabel(p: number): string {
  if (p === 4) return "!!!";
  if (p === 3) return "!!";
  if (p === 2) return "!";
  return "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function printTasks(tasks: TodoTask[]): void {
  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
  out.info(`${sorted.length} task${sorted.length === 1 ? "" : "s"}`);
  if (sorted.length === 0) return;
  out.blank();
  out.table(
    ["ID", "P", "Due", "Content", "Labels"],
    sorted.map((t) => [t.id, priorityLabel(t.priority), t.dueDate ?? "", truncate(t.content, 60), t.labels.join(",")])
  );
}

function printProjects(projects: TodoProject[]): void {
  const sorted = [...projects].sort((a, b) => a.order - b.order);
  out.heading("Projects");
  out.blank();
  out.table(
    ["ID", "Name", "View", "Fav"],
    sorted.map((p) => [p.id, p.parentId ? "  └ " + p.name : p.name, p.viewStyle, p.isFavorite ? "★" : ""])
  );
}

// ── Program ───────────────────────────────────────────────────

const program = new Command();
program.name("tick").description("Task management CLI for Todoist").version("0.1.1");

// ── Setup (provider-specific) ─────────────────────────────────

program
  .command("setup")
  .description("Save Todoist API token (prompted securely; stored in macOS Keychain)")
  .action(async () => {
    const token = await readSecret("Todoist API token: ");
    if (!token) {
      out.error("No token provided.");
      process.exit(1);
    }
    setSecret("api-token", token);
    out.success("API token saved to Keychain.");
    try {
      const projects = await provider.listProjects();
      out.info(`Connected — ${projects.length} projects found.`);
    } catch (e: unknown) {
      out.error(`Token saved but API check failed: ${(e as Error).message}`);
    }
  });

program
  .command("status")
  .description("Check API connection")
  .action(async () => {
    try {
      if (!hasSecret("api-token")) {
        out.error("No API token in Keychain. Run: tick setup <token>");
        process.exit(1);
      }
      const projects = await provider.listProjects();
      out.success(`${provider.name} API: OK`);
      out.info(`Projects: ${projects.length}`);
      out.info("Credentials: macOS Keychain (service: tick)");
    } catch (e: unknown) {
      out.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command("auth-import-from-luff")
  .description("One-shot: copy Todoist token from legacy luff-todo Keychain entry")
  .addHelpText("after", `
Details:
  For users migrating from the older 'todo' CLI shipped via the luff
  monorepo. Reads the credential stored under the 'luff-todo' Keychain
  service and copies it to 'tick'. Idempotent — re-run is safe.

  The source entry is NOT deleted; remove it manually with:
    security delete-generic-password -s luff-todo -a api-token

Example:
  tick auth-import-from-luff`)
  .action(() => {
    const { copied, missing } = importFromLuff();
    if (copied.length === 0) {
      out.error("No entries found under luff-todo. Nothing to import.");
      process.exit(1);
    }
    out.success(`Imported ${copied.length} entries from luff-todo:`);
    for (const k of copied) console.log(`  + ${k}`);
    if (missing.length > 0) {
      out.blank();
      out.info(`Missing (not present in luff-todo): ${missing.join(", ")}`);
    }
  });

// ── Overview ──────────────────────────────────────────────────

program
  .command("overview")
  .description("Today + upcoming + projects dashboard")
  .action(async () => {
    out.heading("Todo Overview");
    out.blank();
    out.subheading("Today & Overdue");
    printTasks(await provider.listTasks({ filter: "today | overdue" }));
    out.blank();
    out.subheading("Upcoming (next 7 days)");
    printTasks(await provider.listTasks({ filter: "7 days" }));
    out.blank();
    printProjects(await provider.listProjects());
  });

program
  .command("today")
  .description("Today's and overdue tasks")
  .action(async () => {
    out.heading("Due Today");
    out.blank();
    printTasks(await provider.listTasks({ filter: "today | overdue" }));
  });

// ── Projects ──────────────────────────────────────────────────

const projects = program.command("projects").alias("p").description("Manage projects");

projects
  .command("list").alias("ls").description("List all projects")
  .action(async () => printProjects(await provider.listProjects()));

projects
  .command("get <id>").description("Get project details (JSON)")
  .action(async (id: string) => out.json(await provider.getProject(id)));

projects
  .command("create <name>").alias("add").description("Create a project")
  .option("--parent <id>", "Parent project ID")
  .option("--view <style>", "View style: list, board, calendar")
  .option("--color <color>", "Color name")
  .action(async (name: string, opts: { parent?: string; view?: string; color?: string }) => {
    const p = await provider.createProject(name, { parentId: opts.parent, viewStyle: opts.view, color: opts.color });
    out.success(`Created project: ${p.name} (ID: ${p.id})`);
  });

projects
  .command("delete <id>").alias("rm").description("Delete a project")
  .action(async (id: string) => {
    if (await provider.deleteProject(id)) out.success(`Deleted project ${id}`);
    else out.error(`Failed to delete project ${id}`);
  });

// ── Tasks ─────────────────────────────────────────────────────

const tasks = program.command("tasks").alias("t").description("Manage tasks");

tasks
  .command("list").alias("ls").description("List tasks")
  .option("--project <id>", "Filter by project ID")
  .option("--label <name>", "Filter by label")
  .option("--filter <query>", "Filter query")
  .action(async (opts: { project?: string; label?: string; filter?: string }) => {
    printTasks(await provider.listTasks({ projectId: opts.project, label: opts.label, filter: opts.filter }));
  });

tasks
  .command("get <id>").description("Get task details (JSON)")
  .action(async (id: string) => out.json(await provider.getTask(id)));

tasks
  .command("create <content>").alias("add").description("Create a task")
  .option("--project <id>", "Project ID")
  .option("--section <id>", "Section ID")
  .option("--priority <n>", "Priority 1-4", parseInt)
  .option("--due <string>", "Due date string")
  .option("--labels <list>", "Comma-separated labels")
  .option("--description <text>", "Description")
  .action(async (content: string, opts: { project?: string; section?: string; priority?: number; due?: string; labels?: string; description?: string }) => {
    const t = await provider.createTask(content, {
      projectId: opts.project, sectionId: opts.section, priority: opts.priority,
      dueString: opts.due, labels: opts.labels?.split(",").map((l) => l.trim()), description: opts.description,
    });
    out.success(`Created: ${t.content} (ID: ${t.id})`);
  });

tasks
  .command("quick <text>").alias("q").description("Quick add with natural language")
  .action(async (text: string) => {
    const t = await provider.quickAddTask(text);
    out.success(`Created: ${t.content} (ID: ${t.id}, due: ${t.dueDate ?? "no date"})`);
  });

tasks
  .command("complete <id>").alias("done").description("Mark task as complete")
  .action(async (id: string) => { await provider.completeTask(id); out.success(`Completed task ${id}`); });

tasks
  .command("reopen <id>").description("Reopen a completed task")
  .action(async (id: string) => { await provider.reopenTask(id); out.success(`Reopened task ${id}`); });

tasks
  .command("update <id>").alias("edit").description("Update a task")
  .option("--content <text>", "New content")
  .option("--priority <n>", "Priority 1-4", parseInt)
  .option("--due <string>", "Due date string")
  .option("--labels <list>", "Comma-separated labels")
  .option("--description <text>", "Description")
  .action(async (id: string, opts: { content?: string; priority?: number; due?: string; labels?: string; description?: string }) => {
    await provider.updateTask(id, { content: opts.content, priority: opts.priority, dueString: opts.due, labels: opts.labels?.split(",").map((l) => l.trim()), description: opts.description });
    out.success(`Updated task ${id}`);
  });

tasks
  .command("move <id>").description("Move a task")
  .option("--project <id>", "Target project ID")
  .option("--section <id>", "Target section ID")
  .option("--parent <id>", "Target parent task ID")
  .action(async (id: string, opts: { project?: string; section?: string; parent?: string }) => {
    if (!opts.project && !opts.section && !opts.parent) { out.error("Specify: --project, --section, or --parent"); process.exit(1); }
    await provider.moveTask(id, { projectId: opts.project, sectionId: opts.section, parentId: opts.parent });
    out.success(`Moved task ${id}`);
  });

tasks
  .command("delete <id>").alias("rm").description("Delete a task")
  .action(async (id: string) => {
    if (await provider.deleteTask(id)) out.success(`Deleted task ${id}`);
    else out.error(`Failed to delete task ${id}`);
  });

tasks
  .command("today").description("Today's and overdue tasks")
  .action(async () => { out.heading("Due Today"); out.blank(); printTasks(await provider.listTasks({ filter: "today | overdue" })); });

// ── Labels ────────────────────────────────────────────────────

const labels = program.command("labels").alias("l").description("Manage labels");

labels
  .command("list").alias("ls").description("List all labels")
  .action(async () => {
    const items = await provider.listLabels();
    items.sort((a, b) => a.order - b.order);
    out.heading("Labels");
    out.blank();
    out.table(["ID", "Name", "Color", "Fav"], items.map((l) => [l.id, l.name, l.color, l.isFavorite ? "★" : ""]));
  });

labels
  .command("create <name>").alias("add").description("Create a label")
  .option("--color <color>", "Color name")
  .action(async (name: string, opts: { color?: string }) => {
    const l = await provider.createLabel(name, { color: opts.color });
    out.success(`Created label: ${l.name} (ID: ${l.id})`);
  });

labels
  .command("delete <id>").alias("rm").description("Delete a label")
  .action(async (id: string) => {
    if (await provider.deleteLabel(id)) out.success(`Deleted label ${id}`);
    else out.error(`Failed to delete label ${id}`);
  });

// ── Sections ──────────────────────────────────────────────────

const sections = program.command("sections").alias("s").description("Manage sections");

sections
  .command("list [projectId]").alias("ls").description("List sections")
  .action(async (projectId?: string) => {
    const items = await provider.listSections(projectId);
    items.sort((a, b) => a.order - b.order);
    out.heading("Sections");
    out.blank();
    out.table(["ID", "Name", "Project ID"], items.map((s) => [s.id, s.name, s.projectId]));
  });

sections
  .command("create <name>").alias("add").description("Create a section")
  .requiredOption("--project <id>", "Project ID")
  .action(async (name: string, opts: { project: string }) => {
    const s = await provider.createSection(name, opts.project);
    out.success(`Created section: ${s.name} (ID: ${s.id})`);
  });

// ── Run ───────────────────────────────────────────────────────

try {
  await program.parseAsync(process.argv);
} catch (e: unknown) {
  out.error((e as Error).message);
  process.exit(1);
}
