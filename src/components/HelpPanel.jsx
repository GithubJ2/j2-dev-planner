import Modal from './Modal'

export default function HelpPanel({ onClose }) {
  return (
    <Modal title="How ProjectR works" onClose={onClose}>
      <div className="help">
        <section>
          <h3>Projects and tasks</h3>
          <p>A project is one launch or initiative. It holds a list of tasks, each with an owner, a due date, a priority and help notes. Everyone approved can see every project and tick tasks off.</p>
        </section>
        <section>
          <h3>Working a tracker</h3>
          <ul>
            <li><strong>Tick</strong> the box when a task is done. It records who and when.</li>
            <li><strong>Click a task name</strong> to read its help notes.</li>
            <li><strong>▲ ▼</strong> change priority. Sort by priority, owner, due date or open-first. Filter by owner.</li>
            <li><strong>✎</strong> edits a task. <strong>Add task</strong> at the bottom.</li>
            <li>Due dates show <span style={{ color: 'var(--danger, #a7303f)' }}>red</span> when overdue and amber when due within 3 days.</li>
          </ul>
        </section>
        <section>
          <h3>Tags</h3>
          <p><strong>critical</strong>: launch cannot happen without it. <strong>blocker</strong>: other tasks wait on it.</p>
        </section>
        <section>
          <h3>Export</h3>
          <p><strong>Export</strong> on a project downloads its tasks as a CSV you can open in Excel or share.</p>
        </section>
      </div>
    </Modal>
  )
}
