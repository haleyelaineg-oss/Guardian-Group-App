import { useCallback, useEffect, useMemo, useState } from 'react';
import * as tasksService from './tasksService.js';

// Data + mutations for the Tasks feature. UI components stay presentation-
// only; every Supabase call and cache lives here, same split as
// tasksService (queries) vs. this hook (state or​chestration).
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [eventOptions, setEventOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadTasks = useCallback(async () => {
    try {
      const rows = await tasksService.fetchTasks();
      setTasks(rows);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [taskRows, eventRows] = await Promise.all([
          tasksService.fetchTasks(),
          tasksService.fetchEventsForSelect(),
        ]);
        if (cancelled) return;
        setTasks(taskRows);
        setEventOptions(eventRows);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const eventTitleById = useMemo(
    () => Object.fromEntries(eventOptions.map((ev) => [ev.id, ev.title])),
    [eventOptions]
  );

  async function createTask(payload) {
    await tasksService.createTask(payload);
    await reloadTasks();
    // NOTE: the vanilla saveTask() also called loadCalendarMonth() here to
    // refresh the Calendar's month grid. Calendar doesn't exist in React
    // yet (Phase 9) so there's nothing to refresh — revisit this once it
    // does, so a task created here shows up on the grid without a reload.
  }

  async function updateTask(id, payload) {
    await tasksService.updateTask(id, payload);
    await reloadTasks();
  }

  async function toggleTaskStatus(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await tasksService.setTaskStatus(task.id, newStatus);
    await reloadTasks();
  }

  async function deleteTask(id) {
    await tasksService.deleteTaskById(id);
    await reloadTasks();
  }

  return {
    tasks,
    eventOptions,
    eventTitleById,
    loading,
    error,
    createTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    fetchTaskById: tasksService.fetchTaskById,
  };
}
