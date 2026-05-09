'use client';

import { useEffect, useState } from 'react';

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export type FilterType = 'all' | 'active' | 'completed';

const STORAGE_KEY = 'todo-list-items';

export function useTodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTodos(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      } catch (error) {
        console.error('Failed to save todos:', error);
      }
    }
  }, [todos, mounted]);

  const addTodo = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    setTodos((prev) => [newTodo, ...prev]);
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos((prev) => prev.filter((todo) => !todo.completed));
  };

  return {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    mounted,
  };
}

type TodoListProps = {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  filter: FilterType;
};

export function TodoList({ todos, onToggle, onDelete, filter }: TodoListProps) {
  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <ul className="space-y-2" role="list" aria-label="任务列表">
      {filteredTodos.length === 0 ? (
        <li className="rounded-lg border border-[var(--line-soft)] bg-zinc-50/50 p-8 text-center text-zinc-500">
          {filter === 'all' && '暂无任务，开始添加你的第一个任务吧！'}
          {filter === 'active' && '太棒了！所有任务都已完成。'}
          {filter === 'completed' && '还没有已完成的任务。'}
        </li>
      ) : (
        filteredTodos.map((todo) => (
          <li
            key={todo.id}
            className="group flex items-start gap-3 rounded-lg border border-[var(--line-soft)] bg-white/70 p-3 transition-all hover:bg-white"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
              className="mt-0.5 h-5 w-5 cursor-pointer rounded border-[var(--line-strong)] text-[var(--bg-ink)] focus:ring-2 focus:ring-[var(--bg-ink)] focus:ring-offset-1"
              aria-label={`标记任务为${todo.completed ? '未完成' : '完成'}`}
            />
            <span
              className={`flex-1 break-words text-sm leading-relaxed ${
                todo.completed ? 'text-zinc-400 line-through' : 'text-zinc-700'
              }`}
            >
              {todo.text}
            </span>
            <button
              onClick={() => onDelete(todo.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              aria-label="删除任务"
            >
              <svg
                className="h-5 w-5 text-zinc-400 hover:text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </li>
        ))
      )}
    </ul>
  );
}

type TodoFiltersProps = {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  activeCount: number;
  completedCount: number;
  onClearCompleted: () => void;
};

export function TodoFilters({
  filter,
  onFilterChange,
  activeCount,
  completedCount,
  onClearCompleted,
}: TodoFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-3">
      <div className="flex gap-1">
        <button
          onClick={() => onFilterChange('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[var(--bg-ink)] text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          aria-label="显示全部任务"
        >
          全部
        </button>
        <button
          onClick={() => onFilterChange('active')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-[var(--bg-ink)] text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          aria-label="显示未完成任务"
        >
          进行中 ({activeCount})
        </button>
        <button
          onClick={() => onFilterChange('completed')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-[var(--bg-ink)] text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          aria-label="显示已完成任务"
        >
          已完成 ({completedCount})
        </button>
      </div>
      {completedCount > 0 && (
        <button
          onClick={onClearCompleted}
          className="text-sm text-zinc-500 hover:text-zinc-700"
          aria-label="清除所有已完成任务"
        >
          清除已完成
        </button>
      )}
    </div>
  );
}

type TodoStatsProps = {
  totalCount: number;
  activeCount: number;
  completedCount: number;
};

export function TodoStats({
  totalCount,
  activeCount,
  completedCount,
}: TodoStatsProps) {
  return (
    <div className="border-t border-[var(--line-soft)] pt-3 text-xs text-zinc-500">
      总计 {totalCount} 个任务，{activeCount} 个进行中，{completedCount} 个已完成
    </div>
  );
}
