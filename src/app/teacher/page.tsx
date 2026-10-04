'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Schedule {
  id?: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface Teacher {
  id: number
  name: string
  title: string
  emoji: string
  schedules?: Schedule[]
}

interface QueueItem {
  id: number
  queueNumber: number
  studentId: string
  studentName: string
  status: string
  createdAt: string
  updatedAt: string
}

interface QueueData {
  queues: QueueItem[]
  currentCalling: QueueItem | null
  stats: { waiting: number; calling: number; completed: number; skipped: number }
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const STORAGE_KEY = 'smartqueue_teacher'

export default function TeacherDashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  
  const [activeTab, setActiveTab] = useState<'queue' | 'schedule'>('queue')
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState('')

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []))
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const t = JSON.parse(saved)
        setSelectedTeacher(t)
        setAuthenticated(true)
        initSchedules(t.schedules || [])
      } catch {}
    }
  }, [])

  const initSchedules = (existing: Schedule[]) => {
    const newS = DAY_NAMES.map((_, i) => {
      const found = existing.find(s => s.dayOfWeek === i)
      return found || { dayOfWeek: i, startTime: '09:00', endTime: '16:00', isActive: false }
    })
    setSchedules(newS)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacher) { setAuthError('กรุณาเลือกอาจารย์'); return }
    setAuthError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacher.id, password }),
      })
      const data = await res.json()
      if (data.success) {
        setAuthenticated(true)
        setSelectedTeacher(data.teacher)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.teacher))
        initSchedules(data.teacher.schedules || [])
      } else {
        setAuthError(data.error || 'รหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setAuthError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAuthenticated(false)
    setSelectedTeacher(null)
    setPassword('')
  }

  const fetchQueueData = useCallback(async () => {
    if (!selectedTeacher) return
    try {
      const res = await fetch(`/api/queue?teacherId=${selectedTeacher.id}`)
      if (res.ok) setQueueData(await res.json())
    } catch {}
  }, [selectedTeacher])

  useEffect(() => {
    if (authenticated && activeTab === 'queue') {
      fetchQueueData()
      const i = setInterval(fetchQueueData, 3000)
      return () => clearInterval(i)
    }
  }, [authenticated, activeTab, fetchQueueData])

  const handleQueueAction = async (id: number, action: 'call' | 'complete' | 'skip') => {
    setActionLoading(id)
    try {
      await fetch(`/api/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await fetchQueueData()
    } finally { setActionLoading(null) }
  }

  const handleReset = async () => {
    if (!confirm('ยืนยันการรีเซ็ตคิวทั้งหมดของวันนี้?')) return
    try {
      await fetch('/api/queue/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacher?.id }),
      })
      await fetchQueueData()
    } catch {}
  }

  const handleScheduleChange = (index: number, field: keyof Schedule, value: any) => {
    const newS = [...schedules]
    newS[index] = { ...newS[index], [field]: value }
    setSchedules(newS)
  }

  const saveSchedules = async () => {
    if (!selectedTeacher) return
    setScheduleLoading(true)
    setScheduleMsg('')
    try {
      const res = await fetch(`/api/teachers/${selectedTeacher.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: schedules.filter(s => s.isActive) }),
      })
      if (res.ok) {
        const data = await res.json()
        const updatedTeacher = { ...selectedTeacher, schedules: data.schedules }
        setSelectedTeacher(updatedTeacher)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeacher))
        setScheduleMsg('SUCCESS')
        setTimeout(() => setScheduleMsg(''), 3000)
      } else {
        setScheduleMsg('ERROR')
      }
    } catch {
      setScheduleMsg('CONNECTION ERROR')
    } finally {
      setScheduleLoading(false)
    }
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

  // ═══════════════════════════════════════════
  //  LOGIN SCREEN
  // ═══════════════════════════════════════════
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 relative overflow-hidden flex flex-col items-center justify-center p-5 font-sans">
        <div className="fixed inset-0 z-[-2] bg-grid opacity-20" />
        <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-red-600/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

        <div className="w-full max-w-md glass-panel rounded-3xl overflow-hidden relative z-10 border-t border-t-orange-500">
          <div className="p-8 text-center border-b border-gray-800">
            <h1 className="text-2xl font-bold tracking-widest text-white">SYSTEM<span className="text-gradient-warm">AUTH</span></h1>
            <p className="text-gray-500 text-xs tracking-widest uppercase mt-2">Instructor Access Panel</p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-6">
            {!selectedTeacher ? (
              <div className="space-y-3">
                {teachers.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTeacher(t); setAuthError(''); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 hover:border-orange-500 hover:bg-orange-500/10 cursor-pointer transition-all group"
                  >
                    <div className="text-2xl bg-gray-900 w-12 h-12 flex items-center justify-center rounded-lg border border-gray-700 group-hover:border-orange-500 transition-colors">{t.emoji}</div>
                    <div>
                      <div className="font-bold text-gray-200">{t.name}</div>
                      <div className="text-[10px] text-gray-500 tracking-widest uppercase">{t.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="text-3xl">{selectedTeacher.emoji}</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-orange-400 tracking-widest uppercase">AUTHENTICATING AS</div>
                    <div className="font-bold text-white">{selectedTeacher.name}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedTeacher(null)} className="text-[10px] text-gray-400 hover:text-white uppercase tracking-widest">
                    CHANGE
                  </button>
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="ENTER PIN"
                    className="input-cyber-warm text-center tracking-[0.5em] text-xl font-mono"
                    autoFocus
                  />
                </div>
                {authError && <div className="text-red-400 text-xs text-center font-mono uppercase tracking-wider">{authError}</div>}
                <button type="submit" className="btn-neon-warm w-full py-4 rounded-xl font-bold tracking-widest">
                  ACCESS GRANTED
                </button>
              </div>
            )}
            <Link href="/" className="block text-center text-xs text-gray-500 hover:text-orange-400 uppercase tracking-widest transition-colors mt-6">
              ← RETURN TO STUDENT PORTAL
            </Link>
          </form>
        </div>
      </div>
    )
  }

  const waitingQueues = queueData?.queues.filter(q => q.status === 'WAITING') ?? []

  // ═══════════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden font-sans pb-20">
      <div className="fixed inset-0 z-[-2] bg-grid opacity-20" />
      <div className="fixed top-0 right-0 w-[40vw] h-[40vw] bg-orange-600/10 rounded-full blur-[120px] animate-pulse-glow z-[-1]" />
      <div className="fixed bottom-0 left-0 w-[30vw] h-[30vw] bg-red-600/10 rounded-full blur-[100px] animate-pulse-glow z-[-1]" style={{ animationDelay: '2s' }} />

      <header className="sticky top-0 z-50 glass-panel border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl bg-gray-900 border border-orange-500/30 w-12 h-12 flex items-center justify-center rounded-xl shadow-[0_0_15px_rgba(255,94,0,0.2)]">
                {selectedTeacher?.emoji}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{selectedTeacher?.name}</h1>
                <p className="text-orange-400 text-[10px] tracking-widest uppercase">Command Center</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-all">Student View</Link>
              <button onClick={handleLogout} className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-red-400 hover:text-white border border-red-900 hover:bg-red-900/50 rounded-lg transition-all">Logout</button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-6 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-6 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'queue' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-gray-500 hover:text-gray-300'}`}
            >
              ACTIVE QUEUE
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'schedule' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-gray-500 hover:text-gray-300'}`}
            >
              SCHEDULE
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {/* ─── TAB: QUEUE ─── */}
        {activeTab === 'queue' && (
          <div className="space-y-8">
            {/* Stats */}
            {queueData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'WAITING', v: queueData.stats.waiting, color: 'text-amber-400' },
                  { l: 'SERVING', v: queueData.stats.calling, color: 'text-green-400' },
                  { l: 'COMPLETED', v: queueData.stats.completed, color: 'text-blue-400' },
                  { l: 'SKIPPED', v: queueData.stats.skipped, color: 'text-gray-500' },
                ].map(s => (
                  <div key={s.l} className="glass-panel rounded-xl p-6 text-center">
                    <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.v}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Col: Serving */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-panel rounded-2xl p-6 border-t-2 border-t-green-500 relative overflow-hidden">
                  <h2 className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> CURRENTLY SERVING
                  </h2>
                  
                  {queueData?.currentCalling ? (
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-2xl bg-gray-900 border border-green-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.1)] mb-6">
                        <span className="text-6xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{queueData.currentCalling.studentId}</div>
                      <div className="text-green-400 font-medium mb-8">{queueData.currentCalling.studentName || '—'}</div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'complete')} disabled={actionLoading === queueData.currentCalling.id} className="py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-xl font-bold text-xs tracking-widest uppercase transition-all">
                          DONE
                        </button>
                        <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'skip')} disabled={actionLoading === queueData.currentCalling.id} className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 rounded-xl font-bold text-xs tracking-widest uppercase transition-all">
                          SKIP
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-600 font-mono text-sm">
                      [ IDLE ]
                    </div>
                  )}
                </div>

                {/* Reset Panel */}
                <div className="glass-panel rounded-2xl p-6 border border-red-900/50">
                  <h3 className="text-xs font-bold text-red-500 tracking-widest uppercase mb-2">SYSTEM OVERRIDE</h3>
                  <p className="text-[10px] text-gray-500 mb-4">Clear all queues for today and reset the counter.</p>
                  <button onClick={handleReset} className="w-full py-2.5 text-xs font-bold tracking-widest uppercase text-red-400 hover:text-white border border-red-900 hover:bg-red-900/50 rounded-lg transition-all">
                    PURGE ALL QUEUES
                  </button>
                </div>
              </div>

              {/* Right Col: Waiting List */}
              <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/30">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PENDING REQUESTS</h2>
                  <span className="text-xs font-mono text-orange-400">TOTAL: {waitingQueues.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[600px] p-2">
                  {waitingQueues.length > 0 ? (
                    <div className="space-y-2">
                      {waitingQueues.map((q, i) => (
                        <div key={q.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/30 hover:bg-gray-800/50 transition-colors flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gray-950 border border-gray-700 flex items-center justify-center font-black text-xl text-white">
                              {q.queueNumber}
                            </div>
                            <div>
                              <div className="font-bold text-gray-200">{q.studentId} <span className="text-gray-500 font-normal ml-2">{q.studentName}</span></div>
                              <div className="text-[10px] text-gray-500 font-mono mt-1">T-MINUS: {formatTime(q.createdAt)} {i === 0 && <span className="ml-2 text-orange-400">NEXT IN LINE</span>}</div>
                            </div>
                          </div>
                          <button onClick={() => handleQueueAction(q.id, 'call')} disabled={actionLoading === q.id || !!queueData?.currentCalling} className={`px-6 py-3 rounded-lg font-bold text-xs tracking-widest uppercase transition-all ${queueData?.currentCalling ? 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed' : 'btn-neon-warm'}`}>
                            CALL
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-600 font-mono text-sm">
                      [ NO PENDING REQUESTS ]
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: SCHEDULE ─── */}
        {activeTab === 'schedule' && (
          <div className="glass-panel rounded-2xl p-8 max-w-3xl mx-auto border-t-2 border-t-orange-500">
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white tracking-widest uppercase mb-1">OPERATIONAL HOURS</h2>
              <p className="text-gray-500 text-xs tracking-widest uppercase">Configure your weekly availability window.</p>
            </div>
            
            <div className="space-y-4">
              {schedules.map((s, i) => (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${s.isActive ? 'border-orange-500/30 bg-orange-500/5' : 'border-gray-800 bg-gray-900/30'}`}>
                  <label className="flex items-center gap-4 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={s.isActive}
                        onChange={e => handleScheduleChange(i, 'isActive', e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                    <span className={`font-bold tracking-widest uppercase text-sm ${s.isActive ? 'text-orange-400' : 'text-gray-500'}`}>{DAY_NAMES[i]}</span>
                  </label>
                  
                  {s.isActive && (
                    <div className="flex items-center gap-3 mt-4 sm:mt-0">
                      <input type="time" value={s.startTime} onChange={e => handleScheduleChange(i, 'startTime', e.target.value)} className="input-cyber-warm py-2 px-3 w-32 text-center font-mono text-sm" />
                      <span className="text-gray-600 font-mono">—</span>
                      <input type="time" value={s.endTime} onChange={e => handleScheduleChange(i, 'endTime', e.target.value)} className="input-cyber-warm py-2 px-3 w-32 text-center font-mono text-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-800 flex items-center justify-between">
              <span className={`text-xs font-mono font-bold tracking-widest uppercase ${scheduleMsg === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}>
                {scheduleMsg}
              </span>
              <button onClick={saveSchedules} disabled={scheduleLoading} className="btn-neon-warm px-8 py-3 rounded-xl font-bold tracking-widest uppercase text-sm">
                {scheduleLoading ? 'SAVING...' : 'SAVE CONFIGURATION'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
