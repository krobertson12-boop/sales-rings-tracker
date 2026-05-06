import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const METRICS = [
  {key:'meetings_set',  label:'Meetings set',         pts:1, scored:true,  color:'#1a56db', trackColor:'#b5d4f4', minDefault:5},
  {key:'meetings_ran',  label:'Meetings ran',          pts:2, scored:true,  color:'#059669', trackColor:'#a7f3d0', minDefault:3},
  {key:'opportunities', label:'Opportunities created', pts:6, scored:true,  color:'#7c3aed', trackColor:'#ddd6fe', minDefault:1},
  {key:'credit_apps',   label:'Credit apps',           pts:10, scored:true, color:'#d97706', trackColor:'#fed7aa', minDefault:0},
  {key:'lasers_sold',   label:'Lasers sold',           pts:20, scored:true, color:'#db2777', trackColor:'#fbcfe8', minDefault:0},
]

const REPS = ['Dana', 'Max', 'Lily', 'Jeff', 'Lindsey', 'Seth', 'Will', 'Daniel']

const DEFAULT_TARGETS  = {meetings_set:10, meetings_ran:5,  opportunities:3,  credit_apps:5, lasers_sold:2}
const DEFAULT_MINIMUMS = {meetings_set:5,  meetings_ran:3,  opportunities:1,  credit_apps:0, lasers_sold:0}

const AVATAR_COLORS = [
  {bg:'#e8f0fd',fg:'#1a56db'},{bg:'#d1fae5',fg:'#059669'},{bg:'#ede9fe',fg:'#7c3aed'},
  {bg:'#fef3c7',fg:'#d97706'},{bg:'#fce7f3',fg:'#db2777'},{bg:'#e1f5ee',fg:'#0f6e56'},
]

function App() {
  const [currentRep, setCurrentRep] = useState(REPS[0])
  const [currentView, setCurrentView] = useState('my')
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10))
  const [entry, setEntry] = useState({})
  const [targets, setTargets] = useState(DEFAULT_TARGETS)
  const [minimums, setMinimums] = useState(DEFAULT_MINIMUMS)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntry()
    loadTargets()
    loadLeaderboard()
  }, [currentRep, today])

  const loadEntry = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('rep_name', currentRep)
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        setEntry(data)
      } else {
        setEntry({})
      }
    } catch (err) {
      console.error('Error loading entry:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTargets = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('setting_type', 'targets')
        .single()
      if (data) setTargets(JSON.parse(data.value))
    } catch (err) {
      console.error('Error loading targets:', err)
    }
  }

  const loadLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .eq('date', today)
      if (data) {
        const lb = REPS.map((rep, i) => {
          const repEntry = data.find(e => e.rep_name === rep) || {}
          const score = METRICS.filter(m => m.scored).reduce(
            (s, m) => s + ((parseInt(repEntry[m.key]) || 0) * m.pts),
            0
          )
          return { rep, score, entry: repEntry, i }
        }).sort((a, b) => b.score - a.score)
        setLeaderboardData(lb)
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err)
    }
  }

  const handleInputChange = (key, value) => {
    setEntry({ ...entry, [key]: parseInt(value) || 0 })
  }

  const saveToday = async () => {
    try {
      const { error } = await supabase.from('entries').upsert(
        {
          rep_name: currentRep,
          date: today,
          ...entry,
        },
        { onConflict: 'rep_name,date' }
      )
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      loadLeaderboard()
    } catch (err) {
      console.error('Error saving entry:', err)
      alert('Error saving entry: ' + err.message)
    }
  }

  const calcScore = (e) => {
    return METRICS.filter(m => m.scored).reduce(
      (s, m) => s + ((parseInt(e[m.key]) || 0) * m.pts),
      0
    )
  }

  const score = calcScore(entry)
  const pct = (val, target) => Math.min(1, Math.max(0, (parseInt(val) || 0) / Math.max(1, target)))

  const drawRingSVG = (val, target, minVal, color, trackColor) => {
    const R = 28, CX = 36, CY = 36, circ = 2 * Math.PI * R
    const SIZE = 72
    const fillPct = pct(val, target)
    const dash = fillPct * circ
    const offset = circ * 0.25

    const minFrac = Math.min(1, Math.max(0, minVal / Math.max(1, target)))
    const minAngle = -Math.PI / 2 + minFrac * 2 * Math.PI
    const tickLen = 6
    const ox = CX + Math.cos(minAngle) * (R + tickLen / 2)
    const oy = CY + Math.sin(minAngle) * (R + tickLen / 2)
    const ix = CX + Math.cos(minAngle) * (R - tickLen / 2)
    const iy = CY + Math.sin(minAngle) * (R - tickLen / 2)

    const labelR = R + 14
    const lx = CX + Math.cos(minAngle) * labelR
    const ly = CY + Math.sin(minAngle) * labelR

    const hitMin = (parseInt(val) || 0) >= minVal
    const tickColor = hitMin ? color : '#b0aeb8'
    const labelColor = hitMin ? color : '#b0aeb8'

    const minMarker = minVal > 0 ? `
      <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${iy.toFixed(1)}"
        stroke="${tickColor}" stroke-width="2" stroke-linecap="round"/>
      <text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}"
        font-size="7" font-family="sans-serif" text-anchor="middle"
        fill="${labelColor}" font-weight="500">min ${minVal}</text>
    ` : ''

    return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${trackColor}" stroke-width="6"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round"/>
      ${minMarker}
    </svg>`
  }

  const dateStr = new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="topbar-left">
          <h1>Daily activity</h1>
          <p>{dateStr}</p>
        </div>
        <div className="view-tabs">
          <button className={`vtab ${currentView === 'my' ? 'active' : ''}`} onClick={() => setCurrentView('my')}>My day</button>
          <button className={`vtab ${currentView === 'board' ? 'active' : ''}`} onClick={() => setCurrentView('board')}>Leaderboard</button>
        </div>
      </div>

      <div className="rep-pill-row">
        {REPS.map(rep => (
          <button
            key={rep}
            className={`rep-pill ${rep === currentRep ? 'active' : ''}`}
            onClick={() => setCurrentRep(rep)}
          >
            {rep}
          </button>
        ))}
      </div>

      {currentView === 'my' && (
        <div id="view-my">
          <div className="score-hero">
            <div className="pts">{score}</div>
            <div className="pts-lbl">rep score today</div>
          </div>
          <div className="rings-grid">
            {METRICS.map(m => {
              const val = parseInt(entry[m.key]) || 0
              const tgt = targets[m.key] || 1
              const minV = minimums[m.key] || 0
              const p = pct(val, tgt)
              const hitMin = val >= minV
              const ptsEarned = m.scored ? (val * m.pts) + ' pts' : 'tracking'
              const ptsColor = m.scored ? m.color : '#888780'

              return (
                <div key={m.key} className="ring-card" style={m.scored ? { borderLeft: `2px solid ${m.color}` } : {}}>
                  <div className="ring-svg-wrap">
                    <div dangerouslySetInnerHTML={{ __html: drawRingSVG(val, tgt, minV, m.color, m.trackColor) }} />
                    <div className="ring-center">
                      <span className="rv">{Math.round(p * 100)}%</span>
                      <span className="rt">{val}/{tgt}</span>
                    </div>
                  </div>
                  <div className="ring-info">
                    <div className="ri-label">{m.label}</div>
                    <input
                      className="ri-input"
                      type="number"
                      min="0"
                      value={val || ''}
                      placeholder="0"
                      onChange={(e) => handleInputChange(m.key, e.target.value)}
                    />
                    <div className="ri-pts" style={{ color: ptsColor }}>{ptsEarned}</div>
                    {minV > 0 && (
                      <div className={`min-badge ${hitMin ? 'hit' : ''}`}>
                        <span className="min-icon"></span>
                        min {minV}{hitMin ? ' ✓' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="save-row">
            <button onClick={saveToday}>Save day</button>
            {saved && <span className="saved-msg">Saved!</span>}
          </div>
        </div>
      )}

      {currentView === 'board' && (
        <div id="view-board">
          <div className="lb-title">Today's leaderboard</div>
          <div className="lb-list">
            {leaderboardData.map((d, rank) => {
              const ac = AVATAR_COLORS[d.i % AVATAR_COLORS.length]
              const initials = d.rep.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const isMe = d.rep === currentRep
              const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1
              const badgeBg = isMe ? '#e8f0fd' : '#f5f5f5'
              const badgeColor = isMe ? '#1a56db' : '#666'

              return (
                <div key={d.rep} className={`lb-row ${isMe ? 'me' : ''}`}>
                  <div className="lb-rank">{typeof medal === 'string' ? medal : medal}</div>
                  <div className="lb-avatar" style={{ background: ac.bg, color: ac.fg }}>{initials}</div>
                  <div className="lb-name">{d.rep}{isMe ? ' (you)' : ''}</div>
                  <div className="lb-rings">
                    {METRICS.map((m, mi) => {
                      const val = parseInt(d.entry[m.key]) || 0
                      const p = pct(val, targets[m.key] || 1)
                      const bg = p >= 1 ? m.color : p > 0 ? m.trackColor : 'transparent'
                      return (
                        <div
                          key={m.key}
                          className="lb-ring-dot"
                          style={{
                            background: bg,
                            borderColor: m.color,
                            opacity: p === 0 ? 0.25 : 1
                          }}
                        />
                      )
                    })}
                  </div>
                  <div className="lb-score-badge" style={{ background: badgeBg, color: badgeColor }}>{d.score} pts</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
