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

  // ─── INIT ───
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

  // ─── AUTH ───
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

  // ─── QUEUE ───
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
    if (!confirm('⚠️ ต้องการลบคิวของวันนี้ทั้งหมดใช่หรือไม่?')) return
    try {
      await fetch('/api/queue/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacher?.id }),
      })
      await fetchQueueData()
    } catch {}
  }

  // ─── SCHEDULE ───
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
        setScheduleMsg('✅ บันทึกตารางสำเร็จ')
        setTimeout(() => setScheduleMsg(''), 3000)
      } else {
        setScheduleMsg('❌ เกิดข้อผิดพลาด')
      }
    } catch {
      setScheduleMsg('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setScheduleLoading(false)
    }
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  // ═══════════════════════════════════════════
  //  LOGIN SCREEN
  // ═══════════════════════════════════════════
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 relative overflow-hidden flex flex-col items-center justify-center p-5">
        <div className="absolute top-10 left-10 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply blur-3xl opacity-40 animate-float" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply blur-3xl opacity-40 animate-float" style={{ animationDelay: '2s' }} />

        <div className="w-full max-w-lg glass rounded-3xl shadow-xl overflow-hidden animate-scale-in relative z-10">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-8 text-center text-white">
            <div className="text-5xl mb-3">🎓</div>
            <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
            <p className="text-amber-100 mt-1">เลือกชื่อของท่านและเข้าสู่ระบบ</p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-6">
            {!selectedTeacher ? (
              <div className="space-y-3">
                {teachers.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTeacher(t); setAuthError(''); }}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer transition-all"
                  >
                    <div className="text-3xl bg-white p-2 rounded-xl shadow-sm">{t.emoji}</div>
                    <div>
                      <div className="font-bold text-gray-800">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                  <div className="text-3xl">{selectedTeacher.emoji}</div>
                  <div>
                    <div className="text-sm text-gray-500">เข้าสู่ระบบในชื่อ</div>
                    <div className="font-bold text-gray-800">{selectedTeacher.name}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedTeacher(null)} className="ml-auto text-sm text-amber-600 font-bold px-3 py-1 bg-amber-100 rounded-lg hover:bg-amber-200">
                    เปลี่ยน
                  </button>
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="รหัสผ่าน"
                    className="input-modern-warm text-center text-xl tracking-widest"
                    autoFocus
                  />
                </div>
                {authError && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-xl">⚠️ {authError}</div>}
                <button type="submit" className="gradient-btn-warm w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg">
                  เข้าสู่ระบบ
                </button>
              </div>
            )}
            <Link href="/" className="block text-center text-sm text-gray-400 hover:text-amber-600 transition-colors">
              ← กลับหน้านักศึกษา
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-float" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />

      <header className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="max-w-4xl mx-auto px-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl bg-white/20 p-2 rounded-2xl backdrop-blur-sm">{selectedTeacher?.emoji}</div>
              <div>
                <h1 className="text-xl font-bold">{selectedTeacher?.name}</h1>
                <p className="text-amber-100 text-sm">Teacher Dashboard</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all">หน้านักศึกษา</Link>
              <button onClick={handleLogout} className="px-4 py-2 bg-black/10 hover:bg-black/20 rounded-xl text-sm font-medium transition-all">ออกจากระบบ</button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-6 p-1 bg-black/10 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'queue' ? 'bg-white text-orange-600 shadow-md' : 'text-white/80 hover:text-white'}`}
            >
              📋 จัดการคิว
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white text-orange-600 shadow-md' : 'text-white/80 hover:text-white'}`}
            >
              📅 ตารางเวลา
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-4xl mx-auto px-5 py-8">
        {/* ─── TAB: QUEUE ─── */}
        {activeTab === 'queue' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Stats */}
            {queueData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'รอเรียก', v: queueData.stats.waiting, icon: '⏳', g: 'from-amber-400 to-orange-500' },
                  { l: 'กำลังตรวจ', v: queueData.stats.calling, icon: '📢', g: 'from-emerald-400 to-green-500' },
                  { l: 'ตรวจแล้ว', v: queueData.stats.completed, icon: '✅', g: 'from-blue-400 to-indigo-500' },
                  { l: 'ข้าม', v: queueData.stats.skipped, icon: '⏭️', g: 'from-gray-400 to-slate-500' },
                ].map(s => (
                  <div key={s.l} className="glass rounded-2xl p-5 flex items-center gap-4 hover:scale-105 transition-transform">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.g} flex items-center justify-center shadow-md shrink-0`}>
                      <span className="text-white text-lg">{s.icon}</span>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-800 leading-none">{s.v}</div>
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-1">{s.l}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Currently Calling */}
            {queueData?.currentCalling && (
              <div className="glass rounded-3xl overflow-hidden glow-green ring-2 ring-green-400/50 animate-bounce-in">
                <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 flex items-center gap-2 text-white font-bold">
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" /> กำลังเรียก
                </div>
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gradient-to-br from-white to-green-50/50">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-3xl flex items-center justify-center shadow-lg shadow-green-200/60 animate-float shrink-0">
                      <span className="text-5xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">{queueData.currentCalling.studentId}</div>
                      {queueData.currentCalling.studentName && <div className="text-lg text-gray-500 font-medium">{queueData.currentCalling.studentName}</div>}
                      <div className="text-sm text-gray-400 mt-2">🕐 จองเมื่อ {formatTime(queueData.currentCalling.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'complete')} disabled={actionLoading === queueData.currentCalling.id} className="flex-1 sm:flex-none px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                      ✅ เสร็จสิ้น
                    </button>
                    <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'skip')} disabled={actionLoading === queueData.currentCalling.id} className="flex-1 sm:flex-none px-6 py-4 bg-white text-gray-600 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                      ⏭️ ข้าม
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting List */}
            <div className="glass rounded-3xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-white/50 flex justify-between items-center bg-white/50">
                <h2 className="font-bold text-gray-700 flex items-center gap-2">📋 คิวที่รอเรียก</h2>
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">{waitingQueues.length} คิว</span>
              </div>
              {waitingQueues.length > 0 ? (
                <div className="divide-y divide-gray-100/60">
                  {waitingQueues.map((q, i) => (
                    <div key={q.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                          {q.queueNumber}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{q.studentId} <span className="text-gray-400 font-normal ml-1">{q.studentName}</span></div>
                          <div className="text-xs text-gray-400 mt-1">🕐 {formatTime(q.createdAt)} {i === 0 && <span className="ml-2 text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded uppercase">ถัดไป</span>}</div>
                        </div>
                      </div>
                      <button onClick={() => handleQueueAction(q.id, 'call')} disabled={actionLoading === q.id || !!queueData?.currentCalling} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${queueData?.currentCalling ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'gradient-btn-warm text-white shadow-md'}`}>
                        📢 เรียก
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-5xl mb-3 opacity-50">🎉</div>
                  <div>ไม่มีคิวรอเรียก</div>
                </div>
              )}
            </div>

            {/* Reset */}
            <div className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 border border-red-100">
              <div>
                <h3 className="font-bold text-gray-700">🗑️ รีเซ็ตระบบ</h3>
                <p className="text-xs text-gray-500 mt-1">ลบคิวของวันนี้ทั้งหมดเพื่อเริ่มต้นวันใหม่</p>
              </div>
              <button onClick={handleReset} className="px-6 py-2.5 text-red-500 border-2 border-red-200 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors">
                รีเซ็ตคิวทั้งหมด
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: SCHEDULE ─── */}
        {activeTab === 'schedule' && (
          <div className="glass rounded-3xl shadow-lg p-6 sm:p-8 animate-fade-in-up">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">📅 ตั้งค่าตารางประจำสัปดาห์</h2>
              <p className="text-gray-500 text-sm mt-1">กำหนดวันและเวลาที่ท่านเปิดรับปรึกษา/ตรวจงาน</p>
            </div>
            
            <div className="space-y-3">
              {schedules.map((s, i) => (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border-2 transition-all ${s.isActive ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100 bg-white/50'}`}>
                  <label className="flex items-center gap-3 cursor-pointer sm:w-32">
                    <input
                      type="checkbox"
                      checked={s.isActive}
                      onChange={e => handleScheduleChange(i, 'isActive', e.target.checked)}
                      className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                    />
                    <span className={`font-bold ${s.isActive ? 'text-orange-700' : 'text-gray-400'}`}>{DAY_NAMES[i]}</span>
                  </label>
                  
                  {s.isActive && (
                    <div className="flex items-center gap-3 animate-fade-in">
                      <input type="time" value={s.startTime} onChange={e => handleScheduleChange(i, 'startTime', e.target.value)} className="input-modern-warm py-2 px-3 w-32 text-center" />
                      <span className="text-gray-400 font-bold">ถึง</span>
                      <input type="time" value={s.endTime} onChange={e => handleScheduleChange(i, 'endTime', e.target.value)} className="input-modern-warm py-2 px-3 w-32 text-center" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4 border-t border-gray-100 pt-6">
              <button onClick={saveSchedules} disabled={scheduleLoading} className="gradient-btn-warm px-8 py-3.5 text-white rounded-2xl font-bold text-lg shadow-lg">
                {scheduleLoading ? '⏳ กำลังบันทึก...' : '💾 บันทึกตาราง'}
              </button>
              {scheduleMsg && <span className={`font-bold ${scheduleMsg.includes('✅') ? 'text-green-600' : 'text-red-600'} animate-slide-right`}>{scheduleMsg}</span>}
            </div>
          </div>
        )}
      </main>
      
      {activeTab === 'queue' && (
        <footer className="text-center py-6 text-xs text-gray-400 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> อัปเดตอัตโนมัติทุก 3 วินาที
        </footer>
      )}
    </div>
  )
}
