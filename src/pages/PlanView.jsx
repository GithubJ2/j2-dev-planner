import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { CATEGORIES, PLAN_STATUSES } from '../lib/constants'
import { flowOrder, removeById, summarize, upsertById } from '../lib/utils'
import StageNode from '../components/StageNode'
import StageDrawer from '../components/StageDrawer'
import ProgressBar from '../components/ProgressBar'
import InlineInput from '../components/InlineInput'
import ActivityPanel from '../components/ActivityPanel'

const nodeTypes = { stage: StageNode }
const DRAWER_OFFSET = 230

export default function PlanView() {
  return (
    <ReactFlowProvider>
      <PlanCanvas />
    </ReactFlowProvider>
  )
}

function PlanCanvas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const rf = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const fitted = useRef(false)

  const [plan, setPlan] = useState(null)
  const [dbNodes, setDbNodes] = useState([])
  const [dbEdges, setDbEdges] = useState([])
  const [fields, setFields] = useState([])
  const [departments, setDepartments] = useState([])
  const [people, setPeople] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [showActivity, setShowActivity] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])

  // ---------- Load ----------
  useEffect(() => {
    let cancelled = false
    fitted.current = false
    setLoading(true)
    setSelectedId(null)
    ;(async () => {
      const results = await Promise.all([
        supabase.from('plans').select('*').eq('id', id).maybeSingle(),
        supabase.from('plan_nodes').select('*').eq('plan_id', id),
        supabase.from('plan_edges').select('*').eq('plan_id', id),
        supabase.from('node_fields').select('*').eq('plan_id', id),
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('profiles').select('id, full_name, email'),
      ])
      if (cancelled) return
      const failed = results.find((r) => r.error)
      if (failed) {
        setError(failed.error.message)
        setLoading(false)
        return
      }
      const [p, n, e, f, d, pr] = results
      if (!p.data) {
        setError('This plan does not exist, or you do not have access to it.')
        setLoading(false)
        return
      }
      setPlan(p.data)
      setDbNodes(n.data)
      setDbEdges(e.data)
      setFields(f.data)
      setDepartments(d.data)
      setPeople(Object.fromEntries(pr.data.map((x) => [x.id, x])))
      setError('')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // ---------- Live updates from teammates ----------
  useEffect(() => {
    const channel = supabase.channel(`plan-${id}-${Math.random().toString(36).slice(2)}`)
    const bind = (table, setter) => {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `plan_id=eq.${id}` }, (pl) =>
        setter((l) => upsertById(l, pl.new))
      )
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `plan_id=eq.${id}` }, (pl) =>
        setter((l) => upsertById(l, pl.new))
      )
      // Delete events cannot be filtered; ids that are not in this plan are simply ignored.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (pl) =>
        setter((l) => removeById(l, pl.old.id))
      )
    }
    bind('plan_nodes', setDbNodes)
    bind('plan_edges', setDbEdges)
    bind('node_fields', setFields)
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${id}` }, (pl) =>
      setPlan((p) => (p ? { ...p, ...pl.new } : p))
    )
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // ---------- Derived data ----------
  const fieldsByNode = useMemo(() => {
    const map = new Map()
    for (const f of [...fields].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!map.has(f.node_id)) map.set(f.node_id, [])
      map.get(f.node_id).push(f)
    }
    return map
  }, [fields])

  const owners = useMemo(
    () => [...new Set(fields.map((f) => f.owner).filter(Boolean))].sort(),
    [fields]
  )

  const summary = useMemo(() => summarize(fields), [fields])
  const order = useMemo(() => flowOrder(dbNodes, dbEdges), [dbNodes, dbEdges])
  const selectedNode = dbNodes.find((n) => n.id === selectedId) || null

  // Keep React Flow nodes in sync with the database, without fighting an active drag.
  useEffect(() => {
    setRfNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]))
      return dbNodes.map((n) => {
        const p = prevMap.get(n.id)
        const nf = fieldsByNode.get(n.id) || []
        return {
          ...(p || {}),
          id: n.id,
          type: 'stage',
          deletable: false,
          position: p?.dragging ? p.position : { x: n.pos_x, y: n.pos_y },
          selected: n.id === selectedId,
          data: {
            title: n.title,
            subtitle: n.subtitle,
            category: n.category,
            fields: nf,
            ownerFilter,
            dimmed: ownerFilter ? !nf.some((f) => f.owner === ownerFilter) : false,
          },
        }
      })
    })
  }, [dbNodes, fieldsByNode, selectedId, ownerFilter, setRfNodes])

  useEffect(() => {
    setRfEdges((prev) => {
      const prevMap = new Map(prev.map((e) => [e.id, e]))
      return dbEdges.map((e) => ({
        ...(prevMap.get(e.id) || {}),
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        label: e.label || undefined,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#8a96a8' },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
      }))
    })
  }, [dbEdges, setRfEdges])

  useEffect(() => {
    if (!loading && nodesInitialized && !fitted.current && rfNodes.length) {
      fitted.current = true
      rf.fitView({ padding: 0.12, duration: 300 })
    }
  }, [loading, nodesInitialized, rfNodes.length, rf])

  // ---------- Mutations ----------
  const report = useCallback((error, what) => toast.error(`Could not ${what}: ${error.message}`), [toast])

  const updatePlan = async (patch) => {
    setPlan((p) => ({ ...p, ...patch }))
    const { error } = await supabase.from('plans').update(patch).eq('id', id)
    if (error) report(error, 'update the plan')
  }

  const updateNode = useCallback(
    async (nodeId, patch) => {
      setDbNodes((l) => l.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)))
      const { error } = await supabase.from('plan_nodes').update(patch).eq('id', nodeId)
      if (error) report(error, 'save the stage')
    },
    [report]
  )

  const updateField = useCallback(
    async (fieldId, patch) => {
      const before = fields.find((f) => f.id === fieldId)
      setFields((l) => l.map((f) => (f.id === fieldId ? { ...f, ...patch, updated_by: user.id, updated_at: new Date().toISOString() } : f)))
      const { data, error } = await supabase.from('node_fields').update(patch).eq('id', fieldId).select().single()
      if (error) {
        if (before) setFields((l) => upsertById(l, before))
        report(error, 'save the answer')
        return
      }
      setFields((l) => upsertById(l, data))
    },
    [fields, report, user.id]
  )

  const addField = useCallback(
    async (nodeId, data) => {
      const siblings = fieldsByNode.get(nodeId) || []
      const sort_order = siblings.reduce((m, f) => Math.max(m, f.sort_order), 0) + 1
      const { data: row, error } = await supabase
        .from('node_fields')
        .insert({ ...data, node_id: nodeId, plan_id: id, sort_order })
        .select()
        .single()
      if (error) return report(error, 'add the question')
      setFields((l) => upsertById(l, row))
    },
    [fieldsByNode, id, report]
  )

  const deleteField = useCallback(
    async (fieldId) => {
      setFields((l) => removeById(l, fieldId))
      const { error } = await supabase.from('node_fields').delete().eq('id', fieldId)
      if (error) report(error, 'delete the question')
    },
    [report]
  )

  const addStage = async () => {
    const pane = document.querySelector('.canvas-wrap')?.getBoundingClientRect()
    const center = pane
      ? rf.screenToFlowPosition({ x: pane.left + pane.width / 2 - 120, y: pane.top + pane.height / 2 - 60 })
      : { x: 0, y: 0 }
    const { data, error } = await supabase
      .from('plan_nodes')
      .insert({ plan_id: id, title: 'New stage', category: 'process', pos_x: center.x, pos_y: center.y })
      .select()
      .single()
    if (error) return report(error, 'add a stage')
    setDbNodes((l) => upsertById(l, data))
    setSelectedId(data.id)
  }

  const deleteStage = async (nodeId) => {
    setSelectedId(null)
    setDbNodes((l) => removeById(l, nodeId))
    setDbEdges((l) => l.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId))
    setFields((l) => l.filter((f) => f.node_id !== nodeId))
    const { error } = await supabase.from('plan_nodes').delete().eq('id', nodeId)
    if (error) report(error, 'delete the stage')
  }

  const onConnect = useCallback(
    async (c) => {
      if (c.source === c.target) return
      const { data, error } = await supabase
        .from('plan_edges')
        .insert({ plan_id: id, source_id: c.source, target_id: c.target })
        .select()
        .single()
      if (error) {
        toast.error(error.code === '23505' ? 'Those stages are already connected.' : `Could not connect the stages: ${error.message}`)
        return
      }
      setDbEdges((l) => upsertById(l, data))
    },
    [id, toast]
  )

  const onEdgesDelete = useCallback(
    async (deleted) => {
      const ids = deleted.map((e) => e.id)
      setDbEdges((l) => l.filter((e) => !ids.includes(e.id)))
      const { error } = await supabase.from('plan_edges').delete().in('id', ids)
      if (error) report(error, 'remove the connection')
    },
    [report]
  )

  const onEdgeDoubleClick = useCallback(
    async (_e, edge) => {
      const current = dbEdges.find((x) => x.id === edge.id)
      const label = window.prompt('Label for this connection (leave empty to clear)', current?.label ?? '')
      if (label === null) return
      const next = label.trim() || null
      setDbEdges((l) => l.map((x) => (x.id === edge.id ? { ...x, label: next } : x)))
      const { error } = await supabase.from('plan_edges').update({ label: next }).eq('id', edge.id)
      if (error) report(error, 'label the connection')
    },
    [dbEdges, report]
  )

  const onNodeDragStop = useCallback(
    async (_e, node, dragged) => {
      const list = dragged?.length ? dragged : [node]
      setDbNodes((l) =>
        l.map((n) => {
          const d = list.find((x) => x.id === n.id)
          return d ? { ...n, pos_x: d.position.x, pos_y: d.position.y } : n
        })
      )
      const results = await Promise.all(
        list.map((d) => supabase.from('plan_nodes').update({ pos_x: d.position.x, pos_y: d.position.y }).eq('id', d.id))
      )
      const failed = results.find((r) => r.error)
      if (failed) report(failed.error, 'save the layout')
    },
    [report]
  )

  // ---------- Walkthrough ----------
  const focusNode = useCallback(
    (nodeId) => {
      setSelectedId(nodeId)
      const n = dbNodes.find((x) => x.id === nodeId)
      if (!n) return
      const offset = window.innerWidth > 900 ? DRAWER_OFFSET : 0
      rf.setCenter(n.pos_x + 125 + offset, n.pos_y + 70, { zoom: 1, duration: 450 })
    },
    [dbNodes, rf]
  )

  const idx = selectedId ? order.indexOf(selectedId) : -1
  const startWalkthrough = () => order.length && focusNode(order[0])

  // ---------- Plan menu ----------
  const duplicate = async (asTemplate) => {
    setMenuOpen(false)
    const title = asTemplate ? `${plan.title} template` : `${plan.title} copy`
    const { data, error } = await supabase.rpc('duplicate_plan', { src: id, new_title: title, keep_values: !asTemplate })
    if (error) return report(error, 'copy the plan')
    if (asTemplate) await supabase.from('plans').update({ is_template: true }).eq('id', data)
    toast.success(asTemplate ? 'Saved as a template' : 'Plan copied')
    navigate(`/plan/${data}`)
  }

  const toggleArchive = async () => {
    setMenuOpen(false)
    await updatePlan({ archived: !plan.archived })
    toast.success(plan.archived ? 'Plan restored' : 'Plan archived')
  }

  const deletePlan = async () => {
    setMenuOpen(false)
    if (!window.confirm(`Delete "${plan.title}" for everyone? This cannot be undone.`)) return
    const { error } = await supabase.from('plans').delete().eq('id', id)
    if (error) return report(error, 'delete the plan')
    toast.success('Plan deleted')
    navigate('/')
  }

  // ---------- Render ----------
  if (loading) return <div className="splash">Loading plan</div>
  if (error)
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/" className="btn btn-ghost">Back to plans</Link>
      </div>
    )

  return (
    <div className="plan-page">
      <header className="plan-bar">
        <div className="plan-bar-main">
          <Link to="/" className="back-link">All plans</Link>
          <div className="plan-name">
            <span className="plan-name-icon" aria-hidden="true">{plan.icon}</span>
            <InlineInput
              className="plan-title-input"
              value={plan.title}
              aria-label="Plan name"
              onSave={(v) => v.trim() && updatePlan({ title: v.trim() })}
            />
          </div>
          <div className="plan-selects">
            <select
              className="input input-compact"
              value={plan.department_id ?? ''}
              onChange={(e) => updatePlan({ department_id: e.target.value || null })}
              aria-label="Department"
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
              ))}
            </select>
            <select
              className={`input input-compact plan-status-select st-${plan.status}`}
              value={plan.status}
              onChange={(e) => updatePlan({ status: e.target.value })}
              aria-label="Plan status"
            >
              {Object.entries(PLAN_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="plan-bar-progress">
          <ProgressBar summary={summary} size="lg" />
        </div>

        <div className="plan-bar-actions">
          <select
            className="input input-compact"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Highlight questions for"
          >
            <option value="">Everyone's questions</option>
            {owners.map((o) => (
              <option key={o} value={o}>Questions for {o}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={startWalkthrough} disabled={!order.length}>Walk through</button>
          <button className="btn btn-ghost" onClick={() => setShowActivity(true)}>Changes</button>
          <button className="btn btn-primary" onClick={addStage}>Add stage</button>
          <div className="menu-wrap">
            <button className="icon-btn" aria-label="More plan actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((m) => !m)}>⋯</button>
            {menuOpen && (
              <div className="menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button role="menuitem" onClick={() => duplicate(false)}>Duplicate with answers</button>
                <button role="menuitem" onClick={() => duplicate(true)}>Save as template</button>
                <button role="menuitem" onClick={toggleArchive}>{plan.archived ? 'Restore plan' : 'Archive plan'}</button>
                <button role="menuitem" className="danger" onClick={deletePlan}>Delete plan</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="canvas-wrap">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeClick={(_e, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          onNodeDragStop={onNodeDragStop}
          deleteKeyCode={['Backspace', 'Delete']}
          minZoom={0.2}
          maxZoom={1.75}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#c3cbd6" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(n) => CATEGORIES[n.data?.category]?.color || '#94a3b8'}
            nodeStrokeWidth={0}
            maskColor="rgba(21, 35, 59, 0.08)"
          />
        </ReactFlow>

        {!selectedNode && (
          <p className="canvas-hint">
            Click a stage to fill it in. Drag from a stage's right edge to connect it. Double-click a line to label it, or select it and press Delete to remove it.
          </p>
        )}

        {selectedNode && (
          <StageDrawer
            key={selectedNode.id}
            node={selectedNode}
            fields={fieldsByNode.get(selectedNode.id) || []}
            people={people}
            owners={owners}
            position={{ index: Math.max(idx, 0), total: order.length }}
            onPrev={idx > 0 ? () => focusNode(order[idx - 1]) : null}
            onNext={idx >= 0 && idx < order.length - 1 ? () => focusNode(order[idx + 1]) : null}
            onClose={() => setSelectedId(null)}
            onUpdateNode={updateNode}
            onUpdateField={updateField}
            onAddField={addField}
            onDeleteField={deleteField}
            onDeleteStage={deleteStage}
          />
        )}
      </div>

      {showActivity && <ActivityPanel planId={id} people={people} onClose={() => setShowActivity(false)} />}
    </div>
  )
}
