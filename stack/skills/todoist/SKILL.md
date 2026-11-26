---
name: todoist
description: Read, create, update, comment on, or complete Todoist tasks through the Todoist MCP server. Use when the user mentions Todoist or asks to manage a task, subtask, section, or due date ("tâche", "sous-tâche", "ma liste Todoist", "coche la tâche", "ajoute un commentaire").
---

# Todoist

Use the Todoist MCP server. If its tools are unavailable or unauthenticated, stop and tell the user to authenticate it with `/mcp`.

## Finding tasks
- **Locate**: search/read the task first, reuse its ID, no dupes. Empty search → try variants (accents, EN/FR).
- **Sections**: act only on the active section (e.g. "To Do"). Never touch Backlog/others unless asked. Never move a task between sections unless told.

## Editing tasks
- **Spec**: never overwrite the task description (= the spec).
- **Status comment**: keep ONE per task, update it in place (never post a second). Only ✅ done, short bullets, point to subtasks.
- **Subtasks = remaining**: create one checkable subtask per item, later phases included. No mixing: remaining → subtasks, comment → done only.
- **Dates**: reschedule due dates, don't rewrite them (kills recurrence).

## Completing tasks
- **Complete**: don't complete a task while subtasks remain open.

## Style
- Write in the task's language, short bullets.
