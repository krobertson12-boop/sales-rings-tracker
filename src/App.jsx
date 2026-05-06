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

const SCORED_METRICS = METRICS.filter(m => ['meetings_set', 'meetings_ran', 'opportunities'].includes(m.key))

const REPS = ['Dana', 'Max', 'Lily', 'Jeff', 'Lindsey', 'Seth', 'Will', 'Daniel']

const DEFAULT_TARGETS  = {meetings_set:10, meetings_ran:5,  opportunities:3,  credit_apps:5, lasers_sold:2}
const DEFAULT_MINIMUMS = {meetings_set:5,  meetings_ran:3,  opportunities:1,  credit_apps:0, lasers_sold:0}

const AVATAR_COLORS = [
  {bg:'#e8f0fd',fg:'#1a56db'},{bg:'#d1fae5',fg:'#059669'},{bg:'#ede9fe',fg:'#7c3aed'},
  {bg:'#fef3c7',fg:'#d97706'},{bg:'#fce7f3',fg:'#db2777'},{bg:'#e1f5ee',fg:'#0f6e56'},
]

const getWeekBounds = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    label: `${monday.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${sunday.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`
  }
}

const getLast4Weeks = () => {
  const weeks = []
  for (let i = 3; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const bounds = getWeekBounds(d)
    weeks.push({ ...bounds, weekNum: i })
  }
  return weeks
}

const hashPassword = (pwd) => {
  let hash = 0
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString()
}

const MANAGER_PASSWORD_HASH = hashPassword('cynomanager')

function App() {
  const [isManager, setIsManager] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [currentRep, setCurrentRep] = useState(REPS[0])
  const [currentView, setCurrentView] = useState('my')
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10))
  const [entry, setEntry] = useState({})
  const [globalTargets, setGlobalTargets] = useState(DEFAULT_TARGETS)
  const [repTargets, setRepTargets] = useState({})
  const [minimums, setMinimums] = useState(DEFAULT_MINIMUMS)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [analyticsData, setAnalyticsData] = useState([])
  const [settingsEdits, setSettingsEdits] = useState({})
  const [weekEntries, setWeekEntries] = useState([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const weekBounds = getWeekBounds(new Date(today))

  const getTargetsForRep = (rep) => {
    return repTargets[rep] || globalTargets
  }

  const targets = getTargetsForRep(currentRep)
  
  // Weekly targets are 5x the daily targets (5-day work week)
  const weeklyTargets = {}
  SCORED_METRICS.forEach(m => {
    weeklyTargets[m.key] = (targets[m.key] || DEFAULT_TARGETS[m.key]) * 5
  })

  // Calculate week totals
  const getWeekTotals = () => {
    const totals = {}
    SCORED_METRICS.forEach(m => totals[m.key] = 0)
    
    weekEntries.forEach(entry => {
      SCORED_METRICS.forEach(m => {
        totals[m.key] += parseInt(entry[m.key]) || 0
      })
    })
    
    return totals
  }

  const weekTotals = getWeekTotals()
  const weekScore = SCORED_METRICS.reduce((s, m) => s + ((weekTotals[m.key] || 0) * m.pts), 0)

  useEffect(() => {
    const savedManager = localStorage.getItem('isManager')
    if (savedManager === 'true') {
      setIsManager(true)
    }
  }, [])

  useEffect(() => {
    loadEntry()
    loadTargets()
    loadWeeklyLeaderboard()
    loadAnalytics()
    loadWeekEntries()
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

  const loadWeekEntries = async () => {
    try {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .eq('rep_name', currentRep)
        .gte('date', weekBounds.start)
        .lte('date', weekBounds.end)
      
      if (data) {
        setWeekEntries(data)
      }
    } catch (err) {
      console.error('Error loading week entries:', err)
    }
  }

  const loadTargets = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('setting_type', 'rep_targets')
      
      if (data) {
        const targets = {}
        data.forEach(row => {
          targets[row.rep_name] = JSON.parse(row.value)
        })
        setRepTargets(targets)
      }

      const { data: globalData } = await supabase
        .from('settings')
        .select('*')
        .eq('setting_type', 'global_targets')
        .single()
      
      if (globalData) {
        setGlobalTargets(JSON.parse(globalData.value))
      }
    } catch (err) {
      console.error('Error loading targets:', err)
    }
  }

  const loadWeeklyLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .gte('date', weekBounds.start)
        .lte('date', weekBounds.end)
      
      if (data) {
        const lb = REPS.map((rep, i) => {
          const repEntries = data.filter(e => e.rep_name === rep)
          let score = 0
          let totals = {}
          METRICS.forEach(m => totals[m.key] = 0)
          
          repEntries.forEach(entry => {
            METRICS.forEach(m => {
              totals[m.key] += parseInt(entry[m.key]) || 0
            })
            score += METRICS.filter(m => m.scored).reduce(
              (s, m) => s + ((parseInt(entry[m.key]) || 0) * m.pts),
              0
            )
          })
          
          return { rep, score, totals, i }
        }).sort((a, b) => b.score - a.score)
        setLeaderboardData(lb)
      }
    } catch (err) {
      console.error('Error loading weekly leaderboard:', err)
    }
  }

  const loadAnalytics = async () => {
    try {
      const weeks = getLast4Weeks()
      const analyticsData = []

      for (const week of weeks) {
        const { data } = await supabase
          .from('entries')
          .select('*')
          .gte('date', week.start)
          .lte('date', week.end)

        if (data) {
          const weekData = {}
          REPS.forEach(rep => {
            const repEntries = data.filter(e => e.rep_name === rep)
            let totals = {}
            METRICS.forEach(m => totals[m.key] = 0)
            
            repEntries.forEach(entry => {
              METRICS.forEach(m => {
                totals[m.key] += parseInt(entry[m.key]) || 0
              })
            })
            
            weekData[rep] = {
              meetings_ran: totals.meetings_ran,
              opportunities: totals.meetings_ran > 0 ? (totals.opportunities / totals.meetings_ran).toFixed(2) : 0,
              credit_apps: totals.meetings_ran > 0 ? (totals.credit_apps / totals.meetings_ran).toFixed(2) : 0,
              lasers_sold: totals.meetings_ran > 0 ? (totals.lasers_sold / totals.meetings_ran).toFixed(2) : 0,
            }
          })
          analyticsData.push({ week: `Week ${4 - week.weekNum}`, weekLabel: week.label, data: weekData })
        }
      }
      
      setAnalyticsData(analyticsData)
    } catch (err) {
      console.error('Error loading analytics:', err)
    }
  }

  const handleLoginSubmit = () => {
    if (hashPassword(loginPassword) === MANAGER_PASSWORD_HASH) {
      setIsManager(true)
      localStorage.setItem('isManager', 'true')
      setShowLoginModal(false)
      setLoginPassword('')
    } else {
      alert('Incorrect password')
      setLoginPassword('')
    }
  }

  const handleLogout = () => {
    setIsManager(false)
    localStorage.removeItem('isManager')
    setShowLoginModal(false)
  }

  const handleInputChange = (key, value) => {
    setEntry({ ...entry, [key]: parseInt(value) || 0 })
  }

  const handleSettingChange = (rep, metric, value) => {
    if (!settingsEdits[rep]) settingsEdits[rep] = { ...getTargetsForRep(rep) }
    settingsEdits[rep][metric] = parseInt(value) || 0
    setSettingsEdits({ ...settingsEdits })
  }

  const saveSettings = async () => {
    try {
      for (const [rep, targets] of Object.entries(settingsEdits)) {
        await supabase.from('settings').upsert(
          {
            setting_type: 'rep_targets',
            rep_name: rep,
            value: JSON.stringify(targets),
          },
          { onConflict: 'setting_type,rep_name' }
        )
      }
      setSettingsEdits({})
      await loadTargets()
      alert('Targets saved!')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Error saving targets: ' + err.message)
    }
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
      loadWeeklyLeaderboard()
      loadAnalytics()
      loadWeekEntries()
    } catch (err) {
      console.error('Error saving entry:', err)
      alert('Error saving entry: ' + err.message)
    }
  }

  const calcScore = (e) => {
    return SCORED_METRICS.reduce(
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

  const getYAxisScale = (metricKey) => {
    if (metricKey === 'meetings_ran') {
      const maxMeetings = Math.max(...analyticsData.map(w => 
        Math.max(...REPS.map(rep => parseInt(w.data[rep]?.meetings_ran || 0)))
      ), 0)
      const step = Math.ceil(maxMeetings / 4) || 1
      return { max: step * 4, step }
    } else {
      const maxRatio = Math.max(...analyticsData.map(w => 
        Math.max(...REPS.map(rep => parseFloat(w.data[rep]?.[metricKey] || 0)))
      ), 0)
      const step = Math.ceil(maxRatio * 4) / 4 || 0.25
      return { max: step * 4, step }
    }
  }

  const dateStr = new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="wrap">
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Manager Login</h2>
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLoginSubmit()}
              autoFocus
            />
            <div className="modal-buttons">
              <button onClick={handleLoginSubmit}>Login</button>
              <button onClick={() => { setShowLoginModal(false); setLoginPassword('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-left">
          <h1>Daily activity</h1>
          <p>{dateStr}</p>
        </div>
        <div className="view-tabs">
          <button className={`vtab ${currentView === 'my' ? 'active' : ''}`} onClick={() => setCurrentView('my')}>My day</button>
          <button className={`vtab ${currentView === 'board' ? 'active' : ''}`} onClick={() => setCurrentView('board')}>Weekly board</button>
          <button className={`vtab ${currentView === 'analytics' ? 'active' : ''}`} onClick={() => setCurrentView('analytics')}>Analytics</button>
          {isManager && <button className={`vtab ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>Settings</button>}
          {!isManager && <button className="vtab" onClick={() => setShowLoginModal(true)}>🔒</button>}
          {isManager && <button className="vtab" onClick={handleLogout}>Logout</button>}
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
          <div style={{marginBottom:'1.5rem'}}>
            <div style={{fontSize:'12px',fontWeight:'500',color:'#666',marginBottom:'8px'}}>Week to date</div>
            <div className="week-rings-grid">
              {SCORED_METRICS.map(m => {
                const val = weekTotals[m.key] || 0
                const tgt = weeklyTargets[m.key] || 1
                const p = pct(val, tgt)
                return (
                  <div key={m.key} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{position:'relative',width:'48px',height:'48px',marginBottom:'4px'}}>
                      <div dangerouslySetInnerHTML={{ __html: drawRingSVG(val, tgt, 0, m.color, m.trackColor).replace(/72/g, '48').replace(/36/g, '24').replace(/28/g, '20') }} />
                      <div style={{position:'absolute',top:0,left:0,width:'48px',height:'48px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                        <span style={{fontSize:'11px',fontWeight:'500',color:'#1a1a1a'}}>{val}/{tgt}</span>
                      </div>
                    </div>
                    <span style={{fontSize:'10px',color:'#666',textAlign:'center',lineHeight:'1.2'}}>{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="score-hero">
            <div className="pts">{weekScore}</div>
            <div className="pts-lbl">week score</div>
          </div>

          <div style={{fontSize:'12px',fontWeight:'500',color:'#666',marginBottom:'8px',marginTop:'1.5rem'}}>Today</div>
          <div className="score-hero" style={{marginBottom:'1rem'}}>
            <div className="pts" style={{fontSize:'36px'}}>{score}</div>
            <div className="pts-lbl">today's score</div>
          </div>

          <div className="rings-grid">
            {SCORED_METRICS.map(m => {
              const val = parseInt(entry[m.key]) || 0
              const tgt = targets[m.key] || DEFAULT_TARGETS[m.key] || 1
              const minV = minimums[m.key] || 0
              const p = pct(val, tgt)
              const hitMin = val >= minV
              const ptsEarned = (val * m.pts) + ' pts'

              return (
                <div key={m.key} className="ring-card" style={{ borderLeft: `2px solid ${m.color}` }}>
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
                    <div className="ri-pts" style={{ color: m.color }}>{ptsEarned}</div>
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
          <div className="lb-title">Week of {weekBounds.label}</div>
          <div className="lb-list">
            {leaderboardData.map((d, rank) => {
              const ac = AVATAR_COLORS[d.i % AVATAR_COLORS.length]
              const initials = d.rep.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const isMe = d.rep === currentRep
              const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1
              const badgeBg = isMe ? '#e8f0fd' : '#f5f5f5'
              const badgeColor = isMe ? '#1a56db' : '#666'
              const repTgts = getTargetsForRep(d.rep)

              return (
                <div key={d.rep} className={`lb-row ${isMe ? 'me' : ''}`}>
                  <div className="lb-rank">{typeof medal === 'string' ? medal : medal}</div>
                  <div className="lb-avatar" style={{ background: ac.bg, color: ac.fg }}>{initials}</div>
                  <div className="lb-name">{d.rep}{isMe ? ' (you)' : ''}</div>
                  <div className="lb-rings">
                    {SCORED_METRICS.map((m, mi) => {
                      const val = d.totals[m.key] || 0
                      const p = pct(val, repTgts[m.key] || DEFAULT_TARGETS[m.key] || 1)
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

      {currentView === 'analytics' && (
        <div id="view-analytics">
          <div style={{marginBottom:'1.5rem'}}>
            <div style={{fontSize:'13px',fontWeight:'500',color:'#666',marginBottom:'1rem'}}>Conversion metrics (last 4 weeks)</div>
            
            <div className="analytics-section">
              <div style={{fontSize:'12px',color:'#666',marginBottom:'0.75rem',fontWeight:'500'}}>Opportunities per meeting ran</div>
              <div className="analytics-table">
                <div className="analytics-header">
                  <span style={{flex:'1.2'}}>Rep</span>
                  {analyticsData.map(w => <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'11px'}}>{w.week}</span>)}
                  <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>Scale</span>
                </div>
                {REPS.map(rep => (
                  <div key={rep} className="analytics-row" style={{borderColor:'#7c3aed'}}>
                    <span style={{flex:'1.2',fontWeight:'500',fontSize:'13px'}}>{rep}</span>
                    {analyticsData.map(w => (
                      <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'13px',color:'#7c3aed',fontWeight:'500'}}>
                        {w.data[rep].opportunities}
                      </span>
                    ))}
                    <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>0-{getYAxisScale('opportunities').max.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-section" style={{marginTop:'1.5rem'}}>
              <div style={{fontSize:'12px',color:'#666',marginBottom:'0.75rem',fontWeight:'500'}}>Credit apps per meeting ran</div>
              <div className="analytics-table">
                <div className="analytics-header">
                  <span style={{flex:'1.2'}}>Rep</span>
                  {analyticsData.map(w => <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'11px'}}>{w.week}</span>)}
                  <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>Scale</span>
                </div>
                {REPS.map(rep => (
                  <div key={rep} className="analytics-row" style={{borderColor:'#d97706'}}>
                    <span style={{flex:'1.2',fontWeight:'500',fontSize:'13px'}}>{rep}</span>
                    {analyticsData.map(w => (
                      <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'13px',color:'#d97706',fontWeight:'500'}}>
                        {w.data[rep].credit_apps}
                      </span>
                    ))}
                    <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>0-{getYAxisScale('credit_apps').max.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-section" style={{marginTop:'1.5rem'}}>
              <div style={{fontSize:'12px',color:'#666',marginBottom:'0.75rem',fontWeight:'500'}}>Lasers sold per meeting ran</div>
              <div className="analytics-table">
                <div className="analytics-header">
                  <span style={{flex:'1.2'}}>Rep</span>
                  {analyticsData.map(w => <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'11px'}}>{w.week}</span>)}
                  <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>Scale</span>
                </div>
                {REPS.map(rep => (
                  <div key={rep} className="analytics-row" style={{borderColor:'#db2777'}}>
                    <span style={{flex:'1.2',fontWeight:'500',fontSize:'13px'}}>{rep}</span>
                    {analyticsData.map(w => (
                      <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'13px',color:'#db2777',fontWeight:'500'}}>
                        {w.data[rep].lasers_sold}
                      </span>
                    ))}
                    <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>0-{getYAxisScale('lasers_sold').max.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-section" style={{marginTop:'1.5rem'}}>
              <div style={{fontSize:'12px',color:'#666',marginBottom:'0.75rem',fontWeight:'500'}}>Total meetings ran</div>
              <div className="analytics-table">
                <div className="analytics-header">
                  <span style={{flex:'1.2'}}>Rep</span>
                  {analyticsData.map(w => <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'11px'}}>{w.week}</span>)}
                  <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>Scale</span>
                </div>
                {REPS.map(rep => (
                  <div key={rep} className="analytics-row" style={{borderColor:'#059669'}}>
                    <span style={{flex:'1.2',fontWeight:'500',fontSize:'13px'}}>{rep}</span>
                    {analyticsData.map(w => (
                      <span key={w.week} style={{flex:'1',textAlign:'center',fontSize:'13px',color:'#059669',fontWeight:'500'}}>
                        {w.data[rep].meetings_ran}
                      </span>
                    ))}
                    <span style={{flex:'0.6',textAlign:'right',fontSize:'10px',color:'#999',paddingRight:'8px'}}>0-{getYAxisScale('meetings_ran').max}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'settings' && isManager && (
        <div id="view-settings">
          <div style={{fontSize:'13px',color:'#666',marginBottom:'1rem',fontWeight:'500'}}>Set daily targets per rep (blank = use default)</div>
          <div className="settings-grid">
            {REPS.map(rep => (
              <div key={rep} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:'12px',padding:'14px 16px',marginBottom:'12px'}}>
                <div style={{fontSize:'13px',fontWeight:'500',color:'#1a1a1a',marginBottom:'12px'}}>{rep}</div>
                {SCORED_METRICS.map(m => {
                  const current = settingsEdits[rep]?.[m.key] !== undefined 
                    ? settingsEdits[rep][m.key] 
                    : getTargetsForRep(rep)[m.key]
                  return (
                    <div key={m.key} style={{marginBottom:'10px'}}>
                      <label style={{fontSize:'11px',color:'#666',display:'block',marginBottom:'4px'}}>{m.label}</label>
                      <input
                        type="number"
                        min="1"
                        value={current || ''}
                        onChange={(e) => handleSettingChange(rep, m.key, e.target.value)}
                        style={{width:'100%',padding:'6px 8px',border:'0.5px solid #d0d0d0',borderRadius:'8px',fontSize:'14px',fontWeight:'500'}}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <button onClick={saveSettings} style={{padding:'10px 20px',background:'#1a56db',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Save all targets</button>
        </div>
      )}
    </div>
  )
}

export default App
