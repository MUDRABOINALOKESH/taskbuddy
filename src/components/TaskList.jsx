function formatDate(date) {
    if (!date) return 'No due date'
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

export default function TaskList({ tasks, onUpdate, onDelete, onEdit }) {
    if (tasks.length === 0) return <div className="empty-state"><span className="empty-mark">✓</span><h3>Nothing on this page.</h3><p>Try a different view, or add a task above.</p></div>

    return (
        <ul className="task-list">
            {tasks.map((task) => (
                <li key={task.id} className={`task-row ${task.completed ? 'completed' : ''}`}>
                    <button className={`task-check ${task.completed ? 'checked' : ''}`} onClick={() => onUpdate({ ...task, completed: !task.completed })} aria-label={task.completed ? `Reopen ${task.text}` : `Complete ${task.text}`}><span>✓</span></button>
                    <div className="task-copy"><span className="task-title">{task.text}</span><span className="task-meta"><span className={`priority-dot ${task.priority.toLowerCase()}`} />{task.priority} <span className="meta-divider">·</span> {task.category}</span></div>
                    <span className={`due-date ${task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && !task.completed ? 'overdue' : ''}`}>{formatDate(task.dueDate)}</span>
                    <div className="task-actions"><button onClick={() => onEdit(task)} aria-label={`Edit ${task.text}`} title="Edit task">✎</button><button onClick={() => onDelete(task.id)} aria-label={`Delete ${task.text}`} title="Delete task">×</button></div>
                </li>
            ))}
        </ul>
    )
}
