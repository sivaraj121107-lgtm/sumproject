/**
 * Personal Productivity Planner
 * Vanilla JS · LocalStorage · ES6+
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'productivity_planner_tasks';

// ─── State ───────────────────────────────────────────────────────────────────
let tasks = [];
let activeFilter = 'all';
let editingTaskId = null;

// ─── DOM References ───────────────────────────────────────────────────────────
const taskForm          = document.getElementById('task-form');
const taskInput         = document.getElementById('task-input');
const prioritySelect    = document.getElementById('priority-select');
const dueDateInput      = document.getElementById('due-date');
const formError         = document.getElementById('form-error');
const taskList          = document.getElementById('task-list');
const emptyState        = document.getElementById('empty-state');
const progressBarFill   = document.getElementById('progress-bar-fill');
const progressText      = document.getElementById('progress-text');
const progressPercent   = document.getElementById('progress-percent');
const progressBarTrack  = document.querySelector('.progress-bar-track');
const filterBtns        = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const clearAllBtn       = document.getElementById('clear-all-btn');
const liveTime          = document.getElementById('live-time');
const liveDate          = document.getElementById('live-date');

// Modal
const editModal         = document.getElementById('edit-modal');
const editForm          = document.getElementById('edit-form');
const editTaskInput     = document.getElementById('edit-task-input');
const editPrioritySelect= document.getElementById('edit-priority-select');
const editDueDateInput  = document.getElementById('edit-due-date');
const editFormError     = document.getElementById('edit-form-error');
const modalCancelBtn    = document.getElementById('modal-cancel-btn');

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Format a date string (YYYY-MM-DD) to a human-readable label.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Check whether a due date is in the past.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    tasks = stored ? JSON.parse(stored) : [];
  } catch {
    tasks = [];
  }
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();

  // Time
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  liveTime.textContent = `${hh}:${mm}:${ss}`;

  // Date
  liveDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function updateProgress() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressBarFill.style.width = `${pct}%`;
  progressText.textContent    = `${completed} / ${total} task${total !== 1 ? 's' : ''} completed`;
  progressPercent.textContent = `${pct}%`;
  progressBarTrack.setAttribute('aria-valuenow', pct);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function getFilteredTasks() {
  switch (activeFilter) {
    case 'active':    return tasks.filter(t => !t.completed);
    case 'completed': return tasks.filter(t => t.completed);
    case 'high':      return tasks.filter(t => t.priority === 'high');
    case 'medium':    return tasks.filter(t => t.priority === 'medium');
    case 'low':       return tasks.filter(t => t.priority === 'low');
    default:          return [...tasks];
  }
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}`;
  li.dataset.id       = task.id;
  li.dataset.priority = task.priority;

  const overdue = !task.completed && isOverdue(task.dueDate);

  li.innerHTML = `
    <input
      type="checkbox"
      class="task-checkbox"
      ${task.completed ? 'checked' : ''}
      aria-label="Mark '${escapeHtml(task.text)}' as ${task.completed ? 'incomplete' : 'complete'}"
    />
    <div class="task-body">
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="task-meta">
        <span class="task-priority-badge badge-${task.priority}">${task.priority}</span>
        ${task.dueDate
          ? `<span class="task-due${overdue ? ' overdue' : ''}">
               ${overdue ? '⚠ Overdue · ' : '📅 '}${formatDate(task.dueDate)}
             </span>`
          : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn edit-btn" aria-label="Edit task" title="Edit">✏️</button>
      <button class="icon-btn delete-btn" aria-label="Delete task" title="Delete">🗑️</button>
    </div>
  `;

  // Toggle complete
  li.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(task.id));

  // Edit
  li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task.id));

  // Delete
  li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

  return li;
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTasks() {
  const filtered = getFilteredTasks();

  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    filtered.forEach(task => fragment.appendChild(createTaskElement(task)));
    taskList.appendChild(fragment);
  }

  updateProgress();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function addTask(text, priority, dueDate) {
  const task = {
    id:        generateId(),
    text:      text.trim(),
    priority,
    dueDate:   dueDate || '',
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);   // newest first
  saveTasks();
  renderTasks();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

function updateTask(id, text, priority, dueDate) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.text     = text.trim();
  task.priority = priority;
  task.dueDate  = dueDate || '';
  saveTasks();
  renderTasks();
}

function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderTasks();
}

function clearAll() {
  if (!tasks.length) return;
  if (!confirm('Are you sure you want to delete ALL tasks? This cannot be undone.')) return;
  tasks = [];
  saveTasks();
  renderTasks();
}

// ─── Form Handling ────────────────────────────────────────────────────────────

function validateTaskText(text, errorEl) {
  if (!text.trim()) {
    errorEl.textContent = 'Task description cannot be empty.';
    return false;
  }
  if (text.trim().length < 2) {
    errorEl.textContent = 'Task must be at least 2 characters.';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text     = taskInput.value;
  const priority = prioritySelect.value;
  const dueDate  = dueDateInput.value;

  if (!validateTaskText(text, formError)) return;

  addTask(text, priority, dueDate);

  // Reset form
  taskInput.value    = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  formError.textContent = '';
  taskInput.focus();
});

// Clear error on input
taskInput.addEventListener('input', () => {
  if (formError.textContent) formError.textContent = '';
});

// ─── Filters ──────────────────────────────────────────────────────────────────

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTasks();
  });
});

clearCompletedBtn.addEventListener('click', clearCompleted);
clearAllBtn.addEventListener('click', clearAll);

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId              = id;
  editTaskInput.value        = task.text;
  editPrioritySelect.value   = task.priority;
  editDueDateInput.value     = task.dueDate || '';
  editFormError.textContent  = '';

  editModal.hidden = false;
  editTaskInput.focus();
}

function closeEditModal() {
  editModal.hidden  = true;
  editingTaskId     = null;
  editFormError.textContent = '';
}

editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text     = editTaskInput.value;
  const priority = editPrioritySelect.value;
  const dueDate  = editDueDateInput.value;

  if (!validateTaskText(text, editFormError)) return;

  updateTask(editingTaskId, text, priority, dueDate);
  closeEditModal();
});

modalCancelBtn.addEventListener('click', closeEditModal);

// Close modal on overlay click
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.hidden) closeEditModal();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadTasks();
  renderTasks();
  updateClock();
  setInterval(updateClock, 1000);
}

init();
