'use client';

import { useState } from 'react';
import {
  useTodoList,
  TodoList,
  TodoFilters,
  TodoStats,
  type FilterType,
} from '@/components/todo-list';

export default function TodoPage() {
  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } =
    useTodoList();
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    addTodo(trimmed);
    setInputValue('');
  };

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card">
        <h1 className="text-2xl font-semibold text-zinc-800 sm:text-3xl">
          Todo List
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          简单的任务管理工具，数据保存在本地浏览器中。
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="card grid gap-3 sm:grid-cols-[1fr_auto]"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="添加新任务..."
          className="input"
          aria-label="新任务内容"
        />
        <button type="submit" className="btn" disabled={!inputValue.trim()}>
          添加
        </button>
      </form>

      <section className="card space-y-4">
        <TodoFilters
          filter={filter}
          onFilterChange={setFilter}
          activeCount={activeCount}
          completedCount={completedCount}
          onClearCompleted={clearCompleted}
        />

        <TodoList
          todos={todos}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
          filter={filter}
        />

        {todos.length > 0 && (
          <TodoStats
            totalCount={todos.length}
            activeCount={activeCount}
            completedCount={completedCount}
          />
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700">快捷键说明</h2>
        <ul className="space-y-1 text-xs text-zinc-600">
          <li>• 在输入框中按 Enter 快速添加任务</li>
          <li>• 点击复选框标记任务完成状态</li>
          <li>• 点击删除图标移除任务</li>
        </ul>
      </section>
    </div>
  );
}
