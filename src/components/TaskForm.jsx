import { useState } from 'react'

export default function TaskForm({ initialTask, onSave, onCancel }) {
    const [text, setText] = useState(initialTask?.text || '')
    const [priority, setPriority] = useState(initialTask?.priority || 'Medium')
    const [category, setCategory] = useState(initialTask?.category || 'General')
    const [dueDate, setDueDate] = useState(initialTask?.dueDate || '')
    const [saving, setSaving] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        if (!text.trim()) return
        setSaving(true)
        try {
            await onSave({ ...initialTask, text: text.trim(), priority, category, dueDate })
            if (!initialTask) {
                setText('')
                setDueDate('')
                setPriority('Medium')
                setCategory('General')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="task-form">
            <div className="task-input-row"><input autoFocus={Boolean(initialTask)} aria-label="Task name" type="text" placeholder="e.g. Send the project notes" value={text} onChange={(event) => setText(event.target.value)} maxLength={160} required /><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : initialTask ? 'Save changes' : 'Add to list'}<span aria-hidden="true">↗</span></button></div>
            <div className="task-options"><label>PRIORITY<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label><label>AREA<select value={category} onChange={(event) => setCategory(event.target.value)}><option>General</option><option>Work</option><option>Personal</option></select></label><label>DUE DATE<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>{initialTask && <button className="cancel-edit" type="button" onClick={onCancel}>Cancel</button>}</div>
        </form>
    )
}
