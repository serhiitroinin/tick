import { test, expect } from "bun:test";
import { mapTask, mapProject } from "./todoist.ts";

test("mapTask flattens the due object into dueDate + isRecurring", () => {
  const t = mapTask({
    id: "1", content: "Buy milk", description: "", project_id: "p1",
    section_id: null, parent_id: null, priority: 3, labels: ["errand"],
    due: { date: "2026-02-14", is_recurring: true },
  });
  expect(t.dueDate).toBe("2026-02-14");
  expect(t.isRecurring).toBe(true);
  expect(t.priority).toBe(3);
  expect(t.projectId).toBe("p1");
  expect(t.labels).toEqual(["errand"]);
});

test("mapTask handles a null due (no date, not recurring)", () => {
  const t = mapTask({
    id: "2", content: "Someday", description: "", project_id: "p1",
    section_id: null, parent_id: null, priority: 1, labels: [], due: null,
  });
  expect(t.dueDate).toBeNull();
  expect(t.isRecurring).toBe(false);
});

test("mapProject maps snake_case to camelCase", () => {
  const p = mapProject({
    id: "p1", name: "Work", parent_id: "root", child_order: 2,
    view_style: "board", is_favorite: true, is_deleted: false, is_archived: false,
  });
  expect(p).toEqual({
    id: "p1", name: "Work", parentId: "root", order: 2, viewStyle: "board", isFavorite: true,
  });
});
