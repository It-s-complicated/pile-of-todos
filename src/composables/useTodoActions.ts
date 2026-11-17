import type { Todo } from '@/db/collections'
import { formatRelativeWeek, type WeekKey } from '@/lib/weeks'

import { useCurrentWeek } from './useCurrentWeek'
import { useToast } from './useToast'
import { useTodos } from './useTodos'

type TodoChange = Partial<Pick<Todo, 'archived' | 'done' | 'label' | 'weekNumber'>>
type ChangeSet = { id: string; next: TodoChange; previous: TodoChange }

function quote(label: string) {
  return label.length > 32 ? `“${label.slice(0, 30)}…”` : `“${label}”`
}

function pluralTasks(count: number) {
  return count === 1 ? '1 task' : `${count} tasks`
}

/**
 * Task actions with a short undo window. Undo queues a fresh update that only
 * restores the fields the action changed, so later edits are never overwritten.
 */
export function useTodoActions() {
  const { canMutateTodos, mutateTodoDisabledReason, updateTodo } = useTodos()
  const currentWeek = useCurrentWeek()
  const toast = useToast()

  function weekName(weekNumber: WeekKey | null) {
    return weekNumber === null ? 'Backlog' : formatRelativeWeek(weekNumber, currentWeek.value)
  }

  async function apply(changes: ChangeSet[], direction: 'next' | 'previous') {
    for (const change of changes) {
      await updateTodo(change.id, change[direction])
    }
  }

  function run(changes: ChangeSet[], message: string | null) {
    if (!canMutateTodos.value) {
      toast.show(mutateTodoDisabledReason.value ?? 'You cannot update tasks right now.', {
        tone: 'error',
      })
      return
    }

    if (changes.length === 0) {
      return
    }

    apply(changes, 'next')
      .then(() => {
        if (!message) {
          return
        }

        toast.show(message, {
          action: {
            label: 'Undo',
            run: () => {
              toast.dismiss()
              apply(changes, 'previous').catch(reportFailure)
            },
          },
        })
      })
      .catch(reportFailure)
  }

  function reportFailure(error: unknown) {
    console.error('Todo update failed:', error)
    toast.show(error instanceof Error ? error.message : 'That change could not be saved.', {
      tone: 'error',
    })
  }

  function toggleDone(todo: Todo) {
    const done = !todo.done
    run(
      [{ id: todo.id, next: { done }, previous: { done: todo.done } }],
      done ? `Done: ${quote(todo.label)}` : `Reopened ${quote(todo.label)}`,
    )
  }

  function moveMany(todos: readonly Todo[], weekNumber: WeekKey | null) {
    const moving = todos.filter((todo) => todo.weekNumber !== weekNumber)
    const message =
      moving.length === 1
        ? `Moved ${quote(moving[0].label)} to ${weekName(weekNumber)}`
        : `Moved ${pluralTasks(moving.length)} to ${weekName(weekNumber)}`

    run(
      moving.map((todo) => ({
        id: todo.id,
        next: { weekNumber },
        previous: { weekNumber: todo.weekNumber },
      })),
      message,
    )
  }

  function move(todo: Todo, weekNumber: WeekKey | null) {
    moveMany([todo], weekNumber)
  }

  function toggleArchived(todo: Todo) {
    const archived = !todo.archived
    run(
      [{ id: todo.id, next: { archived }, previous: { archived: todo.archived } }],
      archived ? `Archived ${quote(todo.label)}` : `Restored ${quote(todo.label)}`,
    )
  }

  function rename(todo: Todo, label: string) {
    if (label === todo.label) {
      return
    }

    run([{ id: todo.id, next: { label }, previous: { label: todo.label } }], null)
  }

  return { move, moveMany, rename, toggleArchived, toggleDone, weekName }
}
