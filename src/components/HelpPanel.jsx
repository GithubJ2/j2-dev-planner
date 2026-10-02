import Modal from './Modal'

export default function HelpPanel({ onClose }) {
  return (
    <Modal title="How J2 Dev Planner works" onClose={onClose}>
      <div className="help">
        <section>
          <h3>Plans, stages and questions</h3>
          <p>A plan is a project or initiative. It is made of stages, the boxes on the canvas, and each stage holds the questions your team needs to answer before the work can be built.</p>
        </section>
        <section>
          <h3>Statuses</h3>
          <ul>
            <li><span className="pip pip-open" /> <strong>Open</strong>: nobody has answered yet.</li>
            <li><span className="pip pip-to_confirm" /> <strong>To confirm</strong>: there is an answer, but someone still needs to sign it off. Answering an open question moves it here automatically.</li>
            <li><span className="pip pip-decided" /> <strong>Decided</strong>: final. The progress bar counts these.</li>
          </ul>
        </section>
        <section>
          <h3>Canvas</h3>
          <ul>
            <li>Click a stage to open it and fill in answers.</li>
            <li>Drag stages to move them. Use <strong>Tidy</strong> to arrange them by flow.</li>
            <li>Drag from a stage's right edge to another stage to connect them. Double-click a line to label it, or select it and press Delete.</li>
            <li><strong>Walk through</strong> steps through stages in order, which works well in meetings.</li>
          </ul>
        </section>
        <section>
          <h3>Checklist</h3>
          <p>The same questions as a single list, in flow order. Filter by status, person or keyword, and answer in place. This is the view to use on a phone.</p>
        </section>
        <section>
          <h3>Working together</h3>
          <p>Everything saves as you go and appears for everyone within a second. Comments sit under each question, <strong>Changes</strong> shows the history, and <strong>Export</strong> produces a document you can send.</p>
        </section>
        <section>
          <h3>Access</h3>
          <p>New sign-ups wait until an admin approves them on the Team page. Every approved member can view and edit every plan.</p>
        </section>
      </div>
    </Modal>
  )
}
