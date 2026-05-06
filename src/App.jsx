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

const CHART_COLORS = ['#1a56db', '#059669', '#7c3aed', '#d97706', '#db2775', '#6b7280', '#f59e0b', '#10b981']

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
  // Start from today and go back to get the last 4 complete weeks
  for (let i = 0; i < 4; i++) {
    const d = new Date()
    // Go back i weeks from today
    d.setDate(d.getDate() - (i * 7))
    const bounds = getWeekBounds(d)
    weeks.push({ ...bounds, weekNum: i })
  }
  // Return in chronological order (oldest first)
  return weeks.reverse()
}

// Get quarter start date (Jan 1, Apr 1, Jul 1, Oct 1)
const getQuarterStart = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  let quarterStart
  
  if (month < 3) quarterStart = new Date(year, 0, 1)
  else if (month < 6) quarterStart = new Date(year, 3, 1)
  else if (month < 9) quarterStart = new Date(year, 6, 1)
  else quarterStart = new Date(year, 9, 1)
  
  return quarterStart.toISOString().slice(0, 10)
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

// Rep passwords - each rep has their own password
const REP_PASSWORDS = {
  'Dana': hashPassword('dana'),
  'Max': hashPassword('max'),
  'Lily': hashPassword('lily'),
  'Jeff': hashPassword('jeff'),
  'Lindsey': hashPassword('lindsey'),
  'Seth': hashPassword('seth'),
  'Will': hashPassword('will'),
  'Daniel': hashPassword('daniel'),
}

function App() {
  const [isManager, setIsManager] = useState(false)
  const [isRepLoggedIn, setIsRepLoggedIn] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginRepName, setLoginRepName] = useState('')
  const [currentRep, setCurrentRep] = useState(REPS[0])
  const [currentView, setCurrentView] = useState('my')
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10))
  const [entry, setEntry] = useState({})
  const [repTargets, setRepTargets] = useState({})
  const [minimums, setMinimums] = useState(DEFAULT_MINIMUMS)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [chartData, setChartData] = useState({})
  const [settingsEdits, setSettingsEdits] = useState({})
  const [weekEntries, setWeekEntries] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedRepLine, setSelectedRepLine] = useState(null)

  const weekBounds = getWeekBounds(new Date(today))

  const loadTargets = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
      
      if (data && data.length > 0) {
        const targets = {}
        data.forEach(row => {
          if (row.rep_name && row.value) {
            try {
              targets[row.rep_name] = JSON.parse(row.value)
            } catch (e) {
              targets[row.rep_name] = DEFAULT_TARGETS
            }
          }
        })
        setRepTargets(targets)
      }
    } catch (err) {
      console.error('Error loading targets:', err)
    }
  }

  const getTargetsForRep = (rep) => {
    return repTargets[rep] || DEFAULT_TARGETS
  }

  const handleSettingChange = (rep, metric, value) => {
    if (!settingsEdits[rep]) {
      settingsEdits[rep] = { ...getTargetsForRep(rep) }
    }
    settingsEdits[rep][metric] = value ? parseInt(value) : 0
    setSettingsEdits({ ...settingsEdits })
  }

  const saveSettings = async () => {
    try {
      if (Object.keys(settingsEdits).length === 0) {
        alert('No changes to save')
        return
      }

      const repsToSave = Object.entries(settingsEdits)

      // Step 1: Delete all old records first
      for (const [rep, targets] of repsToSave) {
        await supabase
          .from('settings')
          .delete()
          .eq('setting_type', 'rep_targets')
          .eq('rep_name', rep)
      }

      // Wait for all deletes to complete
      await new Promise(r => setTimeout(r, 500))

      // Step 2: Insert all new records
      for (const [rep, targets] of repsToSave) {
        const { error } = await supabase
          .from('settings')
          .insert({
            setting_type: 'rep_targets',
            rep_name: rep,
            value: JSON.stringify(targets)
          })
        
        if (error) {
          console.error('Error inserting for', rep, error)
          throw error
        }
      }
      
      setSettingsEdits({})
      await new Promise(r => setTimeout(r, 500))
      await loadTargets()
      alert('Targets saved!')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Error saving targets: ' + err.message)
    }
  }

  const targets = getTargetsForRep(currentRep)
  
  const weeklyTargets = {}
  SCORED_METRICS.forEach(m => {
    weeklyTargets[m.key] = (targets[m.key] || DEFAULT_TARGETS[m.key]) * 5
  })
  // Credit apps is a weekly goal (not multiplied by 5)
  weeklyTargets['credit_apps'] = targets['credit_apps'] || DEFAULT_TARGETS['credit_apps']

  const getWeekTotals = () => {
    const totals = {}
    METRICS.forEach(m => totals[m.key] = 0)
    
    weekEntries.forEach(entry => {
      METRICS.forEach(m => {
        totals[m.key] += parseInt(entry[m.key]) || 0
      })
    })
    
    return totals
  }

  const weekTotals = getWeekTotals()
  const weekScore = SCORED_METRICS.reduce((s, m) => s + ((weekTotals[m.key] || 0) * m.pts), 0)

  useEffect(() => {
    const savedManager = localStorage.getItem('isManager')
    const savedRepName = localStorage.getItem('loggedInRep')
    if (savedManager === 'true') {
      setIsManager(true)
    }
    if (savedRepName) {
      setIsRepLoggedIn(true)
      setCurrentRep(savedRepName)
    }
  }, [])

  useEffect(() => {
    loadEntry()
    loadTargets()
    loadWeeklyLeaderboard()
    loadChartData()
    loadWeekEntries()
    loadAllEntries()
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

  const loadAllEntries = async () => {
    try {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .order('date', { ascending: false })
      
      if (data) {
        setAllEntries(data)
      }
    } catch (err) {
      console.error('Error loading all entries:', err)
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

  const loadChartData = async () => {
    try {
      const weeks = getLast4Weeks()
      const data = {}

      for (const week of weeks) {
        const { data: entries } = await supabase
          .from('entries')
          .select('*')
          .gte('date', week.start)
          .lte('date', week.end)
          .order('date', { ascending: true })

        if (entries) {
          const weekData = {}
          REPS.forEach(rep => {
            const repEntries = entries.filter(e => e.rep_name === rep).sort((a, b) => new Date(a.date) - new Date(b.date))
            let weekTotals = {}
            METRICS.forEach(m => weekTotals[m.key] = 0)
            
            repEntries.forEach(entry => {
              METRICS.forEach(m => {
                weekTotals[m.key] += parseInt(entry[m.key]) || 0
              })
            })
            
            weekData[rep] = {
              opportunities: weekTotals.opportunities > 0 ? (weekTotals.meetings_ran / weekTotals.opportunities).toFixed(2) : 0,
              credit_apps: weekTotals.credit_apps > 0 ? (weekTotals.meetings_ran / weekTotals.credit_apps).toFixed(2) : 0,
              lasers_sold: weekTotals.lasers_sold > 0 ? (weekTotals.meetings_ran / weekTotals.lasers_sold).toFixed(2) : 0,
              lasers_aggregate: weekTotals.lasers_sold,
              meetings_aggregate: weekTotals.meetings_ran,
            }
          })
          data[week.start] = { week: `Week ${4 - week.weekNum}`, data: weekData }
        }
      }
      
      setChartData(data)
    } catch (err) {
      console.error('Error loading chart data:', err)
    }
  }

  const handleLoginSubmit = () => {
    // Check if manager login
    if (loginRepName === 'manager') {
      if (hashPassword(loginPassword) === MANAGER_PASSWORD_HASH) {
        setIsManager(true)
        localStorage.setItem('isManager', 'true')
        setShowLoginModal(false)
        setLoginPassword('')
        setLoginRepName('')
      } else {
        alert('Incorrect manager password')
        setLoginPassword('')
      }
    }
    // Check if rep login
    else if (loginRepName) {
      if (REP_PASSWORDS[loginRepName] && hashPassword(loginPassword) === REP_PASSWORDS[loginRepName]) {
        setIsRepLoggedIn(true)
        setCurrentRep(loginRepName)
        localStorage.setItem('loggedInRep', loginRepName)
        setShowLoginModal(false)
        setLoginPassword('')
        setLoginRepName('')
      } else {
        alert('Incorrect password for ' + loginRepName)
        setLoginPassword('')
      }
    }
  }

  const handleLogout = () => {
    if (isRepLoggedIn) {
      setIsRepLoggedIn(false)
      localStorage.removeItem('loggedInRep')
      setLoginRepName('')
    } else {
      setIsManager(false)
      localStorage.removeItem('isManager')
    }
    setShowLoginModal(false)
  }

  const handleInputChange = (key, value) => {
    setEntry({ ...entry, [key]: parseInt(value) || 0 })
  }

  const saveToday = async () => {const saveToday = async () => {
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
      loadChartData()
      loadWeekEntries()
      loadAllEntries()
    } catch (err) {
      console.error('Error saving entry:', err)
      alert('Error saving entry: ' + err.message)
    }
  }

  const downloadExcel = () => {
    if (allEntries.length === 0) {
      alert('No data to download')
      return
    }

    const groupedData = {}
    allEntries.forEach(entry => {
      const week = getWeekBounds(new Date(entry.date))
      const weekKey = week.start
      if (!groupedData[weekKey]) {
        groupedData[weekKey] = {}
      }
      if (!groupedData[weekKey][entry.rep_name]) {
        groupedData[weekKey][entry.rep_name] = {}
      }
      METRICS.forEach(m => {
        if (!groupedData[weekKey][entry.rep_name][m.key]) {
          groupedData[weekKey][entry.rep_name][m.key] = 0
        }
        groupedData[weekKey][entry.rep_name][m.key] += parseInt(entry[m.key]) || 0
      })
    })

    let csv = 'Week Start,Rep,' + METRICS.map(m => m.label).join(',') + '\n'
    
    Object.keys(groupedData).sort().forEach(weekStart => {
      Object.keys(groupedData[weekStart]).sort().forEach(rep => {
        const row = [weekStart, rep]
        METRICS.forEach(m => {
          row.push(groupedData[weekStart][rep][m.key] || 0)
        })
        csv += row.join(',') + '\n'
      })
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-activity-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
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



  const dateStr = new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const getYAxisScale = (metricKey) => {
    const weeks = Object.keys(chartData).sort()
    if (weeks.length === 0) return { max: 5, step: 1, labels: [0, 1, 2, 3, 4, 5] }
    
    // Collect all non-zero values
    const values = []
    weeks.forEach(week => {
      REPS.forEach(rep => {
        const val = parseFloat(chartData[week].data[rep][metricKey]) || 0
        if (val > 0) values.push(val)
      })
    })
    
    if (values.length === 0) return { max: 5, step: 1, labels: [0, 1, 2, 3, 4, 5] }
    
    // Sort values to find quartiles
    values.sort((a, b) => a - b)
    const q1 = values[Math.floor(values.length * 0.25)]
    const median = values[Math.floor(values.length * 0.5)]
    const q3 = values[Math.floor(values.length * 0.75)]
    const maxVal = values[values.length - 1]
    const minVal = values[0]
    
    // Calculate IQR and identify outliers
    const iqr = q3 - q1
    const outlierThreshold = q3 + (iqr * 1.5)
    const hasOutliers = maxVal > outlierThreshold
    
    // If we have outliers, scale to show them but keep majority in middle
    let max
    if (hasOutliers && maxVal > q3 * 2) {
      // Scale so median is around 1/3 of the axis
      max = maxVal * 1.1
    } else {
      // No significant outliers, scale normally
      max = maxVal * 1.2
    }
    
    // Round to nice number
    const multiplier = Math.pow(10, Math.floor(Math.log10(max)))
    max = Math.ceil((max / multiplier) * 2) * (multiplier / 2)
    
    const step = max / 5
    const labels = []
    for (let i = 0; i <= 5; i++) {
      labels.push((step * i).toFixed(max > 10 ? 0 : 2))
    }
    
    return { max, step, labels }
  }

  return (
    <div className="wrap">
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{loginRepName ? `Login as ${loginRepName}` : 'Login'}</h2>
            {!loginRepName ? (
              <>
                <div style={{fontSize:'12px',color:'#666',marginBottom:'1rem'}}>Select your name:</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1rem'}}>
                  {REPS.map(rep => (
                    <button
                      key={rep}
                      onClick={() => setLoginRepName(rep)}
                      style={{padding:'8px',background:'#f5f5f5',border:'0.5px solid #ddd',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}
                    >
                      {rep}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setLoginRepName('manager')}
                  style={{width:'100%',padding:'8px',background:'#e8f0fd',border:'0.5px solid #1a56db',borderRadius:'8px',fontSize:'12px',fontWeight:'500',cursor:'pointer',color:'#1a56db',marginTop:'8px'}}
                >
                  Manager Login
                </button>
              </>
            ) : (
              <>
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
                  <button onClick={() => { setShowLoginModal(false); setLoginPassword(''); setLoginRepName(''); }}>Back</button>
                </div>
              </>
            )}
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
          {!isRepLoggedIn && !isManager && <button className="vtab" onClick={() => setShowLoginModal(true)}>🔒 Login</button>}
          {(isRepLoggedIn || isManager) && <button className="vtab" onClick={handleLogout}>Logout</button>}
        </div>
      </div>

      {(isRepLoggedIn || isManager) && (
        <div className="rep-pill-row">
          {isManager ? (
            // Managers can switch between reps
            REPS.map(rep => (
              <button
                key={rep}
                className={`rep-pill ${rep === currentRep ? 'active' : ''}`}
                onClick={() => setCurrentRep(rep)}
              >
                {rep}
              </button>
            ))
          ) : (
            // Reps see only their own name (not clickable)
            <div style={{padding:'6px 12px',background:'#f5f5f5',borderRadius:'20px',fontSize:'13px',fontWeight:'500',color:'#1a1a1a'}}>
              {currentRep}
            </div>
          )}
        </div>
      )}

      {currentView === 'my' && (isRepLoggedIn || isManager) && (
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
              {/* Credit Apps Ring */}
              {(() => {
                const creditAppsMetric = METRICS.find(m => m.key === 'credit_apps')
                const val = weekTotals['credit_apps'] || 0
                const tgt = weeklyTargets['credit_apps'] || 1
                const p = pct(val, tgt)
                return (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{position:'relative',width:'48px',height:'48px',marginBottom:'4px'}}>
                      <div dangerouslySetInnerHTML={{ __html: drawRingSVG(val, tgt, 0, creditAppsMetric.color, creditAppsMetric.trackColor).replace(/72/g, '48').replace(/36/g, '24').replace(/28/g, '20') }} />
                      <div style={{position:'absolute',top:0,left:0,width:'48px',height:'48px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                        <span style={{fontSize:'11px',fontWeight:'500',color:'#1a1a1a'}}>{val}/{tgt}</span>
                      </div>
                    </div>
                    <span style={{fontSize:'10px',color:'#666',textAlign:'center',lineHeight:'1.2'}}>Credit apps</span>
                  </div>
                )
              })()}
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
            {METRICS.map(m => {
              const val = parseInt(entry[m.key]) || 0
              const tgt = targets[m.key] || DEFAULT_TARGETS[m.key] || 1
              const minV = minimums[m.key] || 0
              const p = pct(val, tgt)
              const hitMin = val >= minV
              const isScored = SCORED_METRICS.find(sm => sm.key === m.key)
              const ptsEarned = isScored ? (val * m.pts) + ' pts' : 'tracking'
              const ptsColor = isScored ? m.color : '#888780'

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
          <div style={{marginBottom:'2rem'}}>
            <div style={{fontSize:'13px',fontWeight:'500',color:'#666',marginBottom:'1.5rem'}}>4-week performance (all reps)</div>
            
            {(() => {
              const weeks = Object.keys(chartData).sort()
              if (weeks.length === 0) return <div style={{color:'#999',fontSize:'12px'}}>Loading analytics data...</div>
              
              return (
                <>
                  {['opportunities', 'credit_apps', 'lasers_sold', 'lasers_aggregate', 'meetings_aggregate'].map(metricKey => {
                    const labels = {
                      opportunities: 'Meetings Ran → Opportunities',
                      credit_apps: 'Meetings Ran → Credit Apps',
                      lasers_sold: 'Meetings Ran → Lasers Sold',
                      lasers_aggregate: 'Total Lasers Sold',
                      meetings_aggregate: 'Total Meetings Ran'
                    }
                    
                    return (
                      <div key={metricKey} style={{marginBottom:'2rem',background:'#fff',border:'0.5px solid #ddd',borderRadius:'12px',padding:'1rem'}}>
                        <div style={{fontSize:'12px',fontWeight:'500',color:'#666',marginBottom:'1rem'}}>{labels[metricKey]}</div>
                        
                        <svg width="100%" height="320" viewBox="0 0 700 320" style={{border:'0.5px solid #eee',borderRadius:'8px'}}>
                          {(() => {
                            const yScale = getYAxisScale(metricKey)
                            return (
                              <>
                                {/* Grid */}
                                {[0,1,2,3,4,5].map(i => (
                                  <line key={`h-${i}`} x1="50" y1={270-i*45} x2="650" y2={270-i*45} stroke="#f0f0f0" strokeWidth="1" />
                                ))}
                                {weeks.map((_, i) => (
                                  <line key={`v-${i}`} x1={50+i*150} y1="0" x2={50+i*150} y2="280" stroke="#f0f0f0" strokeWidth="1" />
                                ))}
                                
                                {/* Y axis left */}
                                <line x1="50" y1="0" x2="50" y2="280" stroke="#000" strokeWidth="1.5" />
                                
                                {/* Y axis right */}
                                <line x1="660" y1="0" x2="660" y2="280" stroke="#000" strokeWidth="1.5" />
                                
                                {/* Y axis labels right only */}
                                {yScale.labels.map((label, i) => (
                                  <text key={`y-right-${i}`} x="670" y={273-i*45} fontSize="11" fontWeight="600" textAnchor="start" fill="#000">{label}</text>
                                ))}
                                
                                {/* Lines for each rep */}
                                {REPS.map((rep, repIdx) => {
                                  let pathD = ''
                                  let points = []
                                  weeks.forEach((week, weekIdx) => {
                                    const val = parseFloat(chartData[week].data[rep][metricKey]) || 0
                                    // Only include non-zero points in the path
                                    if (val > 0) {
                                      const x = 50 + (weekIdx * 150) + 35
                                      const y = 270 - (Math.min(val, yScale.max) / yScale.max) * 270
                                      pathD += (points.length === 0 ? 'M' : 'L') + x + ' ' + y + ' '
                                      points.push({ x, y, val, rep, weekIdx })
                                    }
                                  })
                                  
                                  const isSelected = selectedRepLine === rep
                                  const lastPoint = points[points.length - 1]
                                  
                                  return (
                                    <g key={`line-${repIdx}`} style={{cursor: 'pointer'}}>
                                      {pathD && (
                                        <>
                                          <path 
                                            d={pathD} 
                                            stroke={CHART_COLORS[repIdx % 8]} 
                                            strokeWidth={isSelected ? '4' : '2.5'} 
                                            fill="none"
                                            onClick={() => setSelectedRepLine(isSelected ? null : rep)}
                                            style={{opacity: selectedRepLine && !isSelected ? 0.2 : 1, transition: 'all 0.2s'}}
                                          />
                                          {points.map((p, idx) => (
                                            <circle 
                                              key={`dot-${idx}`} 
                                              cx={p.x} 
                                              cy={p.y} 
                                              r={isSelected ? '5' : '3.5'} 
                                              fill={CHART_COLORS[repIdx % 8]} 
                                              stroke="#fff" 
                                              strokeWidth={isSelected ? '2' : '1'}
                                              style={{cursor: 'pointer'}}
                                              onClick={() => setSelectedRepLine(isSelected ? null : rep)}
                                            />
                                          ))}
                                          
                                          {/* Tooltip on most recent point when selected */}
                                          {isSelected && lastPoint && (
                                            <g>
                                              {/* Bubble background */}
                                              <rect
                                                x={lastPoint.x + 15}
                                                y={lastPoint.y - 28}
                                                width="140"
                                                height="50"
                                                rx="8"
                                                fill={CHART_COLORS[repIdx % 8]}
                                                opacity="0.95"
                                              />
                                              {/* Pointer */}
                                              <polygon
                                                points={`${lastPoint.x + 10},${lastPoint.y - 20} ${lastPoint.x + 15},${lastPoint.y - 25} ${lastPoint.x + 15},${lastPoint.y - 15}`}
                                                fill={CHART_COLORS[repIdx % 8]}
                                                opacity="0.95"
                                              />
                                              {/* Rep name */}
                                              <text
                                                x={lastPoint.x + 85}
                                                y={lastPoint.y - 8}
                                                fontSize="12"
                                                fontWeight="bold"
                                                fill="#fff"
                                                textAnchor="middle"
                                              >
                                                {rep}
                                              </text>
                                              {/* Metric value */}
                                              <text
                                                x={lastPoint.x + 85}
                                                y={lastPoint.y + 8}
                                                fontSize="14"
                                                fontWeight="bold"
                                                fill="#fff"
                                                textAnchor="middle"
                                              >
                                                {lastPoint.val}
                                              </text>
                                            </g>
                                          )}
                                        </>
                                      )}
                                    </g>
                                  )
                                })}
                                
                                {/* Right side labels - rep names at their end points, close to line */}
                                {REPS.map((rep, repIdx) => {
                                  const lastWeek = weeks[weeks.length - 1]
                                  const val = parseFloat(chartData[lastWeek].data[rep][metricKey]) || 0
                                  const x = 50 + ((weeks.length - 1) * 150) + 35
                                  const y = 270 - (Math.min(val, yScale.max) / yScale.max) * 270
                                  // Only show name if value is not zero
                                  if (val === 0) return null
                                  return (
                                    <text key={`label-${repIdx}`} x={x + 5} y={y + 4} fontSize="10" fontWeight="600" fill={CHART_COLORS[repIdx % 8]}>
                                      {rep}
                                    </text>
                                  )
                                })}
                                
                                {/* X axis labels with Monday dates */}
                                {weeks.map((week, idx) => {
                                  const weekStart = new Date(week)
                                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                                  const dateLabel = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`
                                  return (
                                    <text key={`x-${idx}`} x={50 + (idx * 150) + 35} y="300" fontSize="11" fontWeight="500" textAnchor="middle" fill="#666">
                                      {dateLabel}
                                    </text>
                                  )
                                })}
                              </>
                            )
                          })()}
                        </svg>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {currentView === 'settings' && isManager && (
        <div id="view-settings">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
            <div style={{fontSize:'13px',color:'#666',fontWeight:'500'}}>Daily targets (except Credit Apps, which is weekly)</div>
            <button onClick={downloadExcel} style={{padding:'6px 14px',background:'#059669',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',fontWeight:'500',cursor:'pointer'}}>Download Excel</button>
          </div>
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
                        min="0"
                        step="1"
                        value={current || ''}
                        onChange={(e) => handleSettingChange(rep, m.key, e.target.value)}
                        style={{width:'100%',padding:'6px 8px',border:'0.5px solid #d0d0d0',borderRadius:'8px',fontSize:'14px',fontWeight:'500'}}
                      />
                    </div>
                  )
                })}
                {/* Credit Apps Setting */}
                {(() => {
                  const current = settingsEdits[rep]?.['credit_apps'] !== undefined 
                    ? settingsEdits[rep]['credit_apps'] 
                    : getTargetsForRep(rep)['credit_apps']
                  return (
                    <div style={{marginBottom:'10px'}}>
                      <label style={{fontSize:'11px',color:'#666',display:'block',marginBottom:'4px'}}>Credit apps (weekly goal)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={current || ''}
                        onChange={(e) => handleSettingChange(rep, 'credit_apps', e.target.value)}
                        style={{width:'100%',padding:'6px 8px',border:'0.5px solid #d0d0d0',borderRadius:'8px',fontSize:'14px',fontWeight:'500'}}
                      />
                    </div>
                  )
                })()}
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
