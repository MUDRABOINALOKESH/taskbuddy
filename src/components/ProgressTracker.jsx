export default function ProgressTracker({ tasks }) {
  const completed = tasks.filter((task) => task.completed).length
  const percentage = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)

  return (
    <section className="progress-tracker" aria-label="Task progress">
      <div className="progress-heading"><span>YOUR MOMENTUM</span><strong>{percentage}%</strong></div>
      <div className="progress-bar" role="progressbar" aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100"><div className="progress" style={{ width: `${percentage}%` }} /></div>
      <p>{completed} of {tasks.length} tasks complete</p>
    </section>
  )
}
