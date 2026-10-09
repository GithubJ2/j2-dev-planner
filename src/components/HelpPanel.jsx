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
            <li><strong>Click a task name</strong> (▸ turns ▾) to show its subtasks. Each subtask has its own owner / waiting on, due date and ▲▼ order, kept inside that task. Type in the line under them and press Enter to add one. Click a subtask's name to edit it.</li>
            <li>Ticking every subtask ticks the task. Ticking a task ticks all its subtasks. <strong>Expand all</strong> opens everything.</li>
            <li>The faint speech bubble at the end of each row opens its <strong>comments</strong>. A number shows when there are some. Enter posts, Shift+Enter adds a line.</li>
            <li>Type <strong>@</strong> in a comment, task name or note to mention someone. They get a notification, and so does anyone you add as owner or waiting on.</li>
            <li>The <strong>bell</strong> shows your notifications. Tap one to jump straight to it. Swipe an item left to mark it read, or use <strong>Mark all as read</strong>. Swipe the panel right to close it.</li>
            <li><strong>Owner / waiting on</strong>: dark chips are owners, dashed ⏳ chips are people the owner is waiting on. Click the chips to change them. A task can have several of each.</li>
            <li><strong>▲ ▼</strong> change priority. Sort by priority, owner, due date or open-first. Filter by owner.</li>
            <li><strong>✎</strong> edits a task. <strong>Add task</strong> at the bottom.</li>
            <li>Due dates show <span style={{ color: 'var(--danger, #a7303f)' }}>red</span> when overdue and amber when due within 3 days.</li>
          </ul>
        </section>
        <section>
          <h3>The dump box</h3>
          <p>Got a messy email thread, meeting notes or a screenshot? <strong>Pull the logo down</strong> the page until it becomes a frisbee, let go, and it boomerangs back to open the dump box. (Or press <strong>D</strong>, or the <strong>Dump</strong> button.) Paste anything in. AI sorts it into tasks and subtasks with owners and dates, asks you at most three quick questions, and you check the list before it's added.</p>
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
