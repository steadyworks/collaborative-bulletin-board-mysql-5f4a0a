import { useState, useEffect, useRef, useCallback } from 'react'

const BACKEND_HTTP = 'http://localhost:3001/api'
const BACKEND_WS = 'ws://localhost:3001/ws/'

function NoteCard({ note, isSelected, editedText, onSelect, onTextChange, onSave, onDelete }) {
  const displayText = editedText !== undefined ? editedText : note.text
  const hasUnsavedChanges = editedText !== undefined && editedText !== note.text

  return (
    <div
      data-testid={`note-${note.id}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
        width: 200,
        minHeight: 120,
        background: '#fff9c4',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #d1c45a',
        borderRadius: 6,
        padding: 8,
        boxSizing: 'border-box',
        boxShadow: '2px 2px 6px rgba(0,0,0,0.15)',
        zIndex: isSelected ? 100 : 10,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <textarea
        data-testid={`note-text-${note.id}`}
        value={displayText}
        onChange={(e) => onTextChange(e.target.value)}
        readOnly={!isSelected}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          minHeight: 70,
          border: 'none',
          background: 'transparent',
          resize: 'vertical',
          cursor: isSelected ? 'text' : 'default',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.4,
          padding: 0,
          margin: 0,
          display: 'block',
        }}
      />
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
        {isSelected && (
          <button
            data-testid={`delete-btn-${note.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Delete
          </button>
        )}
        {hasUnsavedChanges && (
          <button
            data-testid={`save-btn-${note.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
            style={{
              background: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Save
          </button>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [notes, setNotes] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [editedTexts, setEditedTexts] = useState({})
  const [connectedCount, setConnectedCount] = useState(0)
  const wsRef = useRef(null)
  const notesRef = useRef(notes)
  const editedTextsRef = useRef(editedTexts)

  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { editedTextsRef.current = editedTexts }, [editedTexts])

  // Load initial notes
  useEffect(() => {
    fetch(`${BACKEND_HTTP}/notes/`)
      .then((r) => r.json())
      .then((data) => {
        const map = {}
        data.forEach((n) => { map[String(n.id)] = { ...n, id: String(n.id) } })
        setNotes(map)
      })
      .catch(console.error)
  }, [])

  // WebSocket connection
  useEffect(() => {
    let ws
    let reconnectTimer
    let alive = true

    const connect = () => {
      if (!alive) return
      ws = new WebSocket(BACKEND_WS)
      wsRef.current = ws

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'note_created') {
          const note = { ...data.note, id: String(data.note.id) }
          setNotes((prev) => ({ ...prev, [note.id]: note }))
        } else if (data.type === 'note_updated') {
          const note = { ...data.note, id: String(data.note.id) }
          setNotes((prev) => ({ ...prev, [note.id]: note }))
        } else if (data.type === 'note_deleted') {
          const id = String(data.id)
          setNotes((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
          setSelectedId((prev) => (prev === id ? null : prev))
          setEditedTexts((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        } else if (data.type === 'user_count') {
          setConnectedCount(data.count)
        }
      }

      ws.onclose = () => {
        if (alive) {
          reconnectTimer = setTimeout(connect, 1000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      alive = false
      clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  }, [])

  const handleBoardClick = useCallback(async (e) => {
    if (e.target !== e.currentTarget) return
    setSelectedId(null)

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    try {
      await fetch(`${BACKEND_HTTP}/notes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      })
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleSave = useCallback(
    async (id) => {
      const note = notesRef.current[id]
      if (!note) return
      const text =
        editedTextsRef.current[id] !== undefined ? editedTextsRef.current[id] : note.text

      try {
        const res = await fetch(`${BACKEND_HTTP}/notes/${id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, x: note.x, y: note.y }),
        })
        if (res.ok) {
          const updatedNote = await res.json()
          const normalized = { ...updatedNote, id: String(updatedNote.id) }
          // Update local state immediately so save button hides before WS arrives
          setNotes((prev) => ({ ...prev, [normalized.id]: normalized }))
          setEditedTexts((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      } catch (err) {
        console.error(err)
      }
    },
    []
  )

  const handleDelete = useCallback(async (id) => {
    try {
      await fetch(`${BACKEND_HTTP}/notes/${id}/`, { method: 'DELETE' })
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleTextChange = useCallback((id, text) => {
    setEditedTexts((prev) => ({ ...prev, [id]: text }))
  }, [])

  const handleSelect = useCallback((id) => {
    setSelectedId(id)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div
        data-testid="board"
        onClick={handleBoardClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#f5f0dc',
          overflow: 'hidden',
          cursor: 'crosshair',
        }}
      >
        {Object.values(notes).map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isSelected={selectedId === note.id}
            editedText={editedTexts[note.id]}
            onSelect={() => handleSelect(note.id)}
            onTextChange={(text) => handleTextChange(note.id, text)}
            onSave={() => handleSave(note.id)}
            onDelete={() => handleDelete(note.id)}
          />
        ))}
      </div>
      <div
        data-testid="connected-count"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.92)',
          padding: '8px 14px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 1000,
          fontSize: 14,
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        {connectedCount}
      </div>
    </div>
  )
}
