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
  
  const [activeTab, setActiveTab] = useState<'queue' | 'schedule' | 'profile'>('queue')
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  
  // Date filter for Queue
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  // Schedule State
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState('')

  // Profile State
  const [profileData, setProfileData] = useState({ name: '', title: '', emoji: '', newPassword: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []))
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const t = JSON.parse(saved)
        setSelectedTeacher(t)
        setAuthenticated(true)
        initSchedules(t.schedules || [])
        setProfileData({ name: t.name, title: t.title, emoji: t.emoji, newPassword: '' })
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
        setProfileData({ name: data.teacher.name, title: data.teacher.title, emoji: data.teacher.emoji, newPassword: '' })
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
      const res = await fetch(`/api/queue?teacherId=${selectedTeacher.id}&date=${selectedDate}`)
      if (res.ok) setQueueData(await res.json())
    } catch {}
  }, [selectedTeacher, selectedDate])

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
    if (!confirm('ยืนยันการเคลียร์คิวทั้งหมดของวันนี้ทิ้ง? (ระบบจะลบข้อมูลคิวทั้งหมดของวันนี้)')) return
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
        setScheduleMsg('บันทึกสำเร็จ')
        setTimeout(() => setScheduleMsg(''), 3000)
      } else {
        setScheduleMsg('เกิดข้อผิดพลาด')
      }
    } catch {
      setScheduleMsg('เชื่อมต่อไม่สำเร็จ')
    } finally {
      setScheduleLoading(false)
    }
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacher) return
    setProfileLoading(true)
    setProfileMsg('')
    try {
      const body: any = { name: profileData.name, title: profileData.title, emoji: profileData.emoji }
      if (profileData.newPassword) {
        body.password = profileData.newPassword
      }
      
      const res = await fetch(`/api/teachers/${selectedTeacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSelectedTeacher(data.teacher)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.teacher))
        setProfileData({ ...profileData, newPassword: '' }) // Clear password field
        setProfileMsg('อัปเดตข้อมูลสำเร็จ')
        // Refresh teachers list for the login screen if they logout
        fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []))
        setTimeout(() => setProfileMsg(''), 3000)
      } else {
        setProfileMsg('เกิดข้อผิดพลาด')
      }
    } catch {
      setProfileMsg('เชื่อมต่อไม่สำเร็จ')
    } finally {
      setProfileLoading(false)
    }
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' })

  // ═══════════════════════════════════════════
  //  หน้าต่างเข้าสู่ระบบ (Login)
  // ═══════════════════════════════════════════
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black relative flex flex-col items-center justify-center p-5 font-sans">
        
        {/* หิมะตก */}
        <div className="snow-container">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="snowflake" />
          ))}
        </div>

        <div className="w-full max-w-md white-card overflow-hidden relative z-10">
          <div className="p-8 text-center border-b border-gray-200 bg-gray-50 rounded-t-3xl">
            <h1 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบอาจารย์</h1>
            <p className="text-gray-500 text-sm mt-2">กรุณาเลือกชื่อและใส่รหัสผ่านเพื่อจัดการคิว</p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-6">
            {!selectedTeacher ? (
              <div className="space-y-3">
                {teachers.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTeacher(t); setAuthError(''); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                  >
                    <div className="text-2xl bg-white w-12 h-12 flex items-center justify-center rounded-lg border shadow-sm">{t.emoji}</div>
                    <div>
                      <div className="font-bold text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-lg shadow-sm">{selectedTeacher.emoji}</div>
                  <div className="flex-1">
                    <div className="text-xs text-blue-600 font-bold">กำลังเข้าสู่ระบบในชื่อ:</div>
                    <div className="font-bold text-gray-900 text-lg">{selectedTeacher.name}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedTeacher(null)} className="text-xs text-blue-600 hover:text-blue-800 underline font-bold">
                    เปลี่ยนชื่อ
                  </button>
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="ใส่รหัสผ่านของคุณ"
                    className="input-clean text-center text-xl tracking-[0.5em]"
                    autoFocus
                  />
                </div>
                {authError && <div className="text-red-500 text-sm text-center font-bold">{authError}</div>}
                <button type="submit" className="btn-primary">
                  เข้าสู่ระบบ
                </button>
              </div>
            )}
            <Link href="/" className="block text-center text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors mt-6">
              ← กลับไปหน้านักศึกษา
            </Link>
          </form>
        </div>
      </div>
    )
  }

  const waitingQueues = queueData?.queues.filter(q => q.status === 'WAITING') ?? []

  // ═══════════════════════════════════════════
  //  หน้าต่างจัดการคิว (Dashboard)
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-black relative font-sans pb-20">
      
      {/* หิมะตก */}
      <div className="snow-container">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="snowflake" />
        ))}
      </div>

      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl bg-white text-black w-12 h-12 flex items-center justify-center rounded-xl shadow-lg shadow-white/20">
                {selectedTeacher?.emoji}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{selectedTeacher?.name}</h1>
                <p className="text-gray-400 text-xs">ระบบจัดการคิวอาจารย์</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="px-4 py-2 text-xs font-bold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-400 rounded-lg transition-all">ดูหน้าจอของนักศึกษา</Link>
              <button onClick={handleLogout} className="px-4 py-2 text-xs font-bold text-red-400 hover:text-white border border-red-900 hover:bg-red-900 rounded-lg transition-all">ออกจากระบบ</button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-6 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'queue' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
            >
              จัดการคิว
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
            >
              ตั้งเวลาทำการ
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
            >
              แก้ไขโปรไฟล์
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8 z-10">
        {/* ─── TAB: จัดการคิว ─── */}
        {activeTab === 'queue' && (
          <div className="space-y-8">
            
            <div className="flex items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
              <span className="text-sm font-bold text-gray-300">📅 เลือกวันที่ต้องการดูคิว:</span>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white text-black font-bold px-4 py-2 rounded-lg text-sm outline-none"
              />
              {selectedDate === todayStr && <span className="text-xs font-bold bg-green-500/20 text-green-400 px-3 py-1 rounded-full">วันนี้</span>}
            </div>

            {/* สถิติ */}
            {queueData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'รอคิวอยู่', v: queueData.stats.waiting, color: 'text-orange-500' },
                  { l: 'กำลังตรวจ', v: queueData.stats.calling, color: 'text-blue-500' },
                  { l: 'เสร็จสิ้นแล้ว', v: queueData.stats.completed, color: 'text-green-500' },
                  { l: 'ข้าม/ไม่มา', v: queueData.stats.skipped, color: 'text-gray-400' },
                ].map(s => (
                  <div key={s.l} className="white-card p-6 text-center">
                    <div className={`text-4xl font-black mb-1 ${s.color}`}>{s.v}</div>
                    <div className="text-sm font-bold text-gray-600">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ซ้าย: คิวที่กำลังเรียก */}
              <div className="lg:col-span-1 space-y-6">
                <div className="white-card p-6 border-t-4 border-t-blue-500">
                  <h2 className="text-sm font-bold text-blue-600 mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> คิวที่กำลังเรียก
                  </h2>
                  
                  {queueData?.currentCalling ? (
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg mb-6 animate-float">
                        <span className="text-6xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">{queueData.currentCalling.studentId}</div>
                      <div className="text-blue-600 font-bold mb-8">{queueData.currentCalling.studentName || '—'}</div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'complete')} disabled={actionLoading === queueData.currentCalling.id} className="py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/30 transition-all">
                          ตรวจเสร็จแล้ว
                        </button>
                        <button onClick={() => handleQueueAction(queueData.currentCalling!.id, 'skip')} disabled={actionLoading === queueData.currentCalling.id} className="py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-sm transition-all">
                          ข้าม (ไม่มา)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-bold">
                      ตอนนี้ยังไม่มีคนตรวจ
                    </div>
                  )}
                </div>

                {/* กล่อง Reset คิว */}
                <div className="white-card p-6 border border-red-100 bg-red-50">
                  <h3 className="text-sm font-bold text-red-600 mb-2">ล้างระบบ</h3>
                  <p className="text-xs text-gray-600 mb-4 font-bold">กดเมื่อจบคาบเรียน เพื่อลบข้อมูลคิวทั้งหมดของวันนี้ทิ้ง</p>
                  <button onClick={handleReset} className="w-full py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/30 transition-all">
                    เคลียร์คิวทั้งหมดทิ้ง
                  </button>
                </div>
              </div>

              {/* ขวา: รายการรอคิว */}
              <div className="lg:col-span-2 white-card overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h2 className="text-sm font-bold text-gray-700">รายการนักศึกษาที่รอคิว</h2>
                  <span className="text-sm font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full">รอทั้งหมด: {waitingQueues.length} คน</span>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[600px] p-4">
                  {waitingQueues.length > 0 ? (
                    <div className="space-y-3">
                      {waitingQueues.map((q, i) => (
                        <div key={q.id} className="p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gray-900 flex items-center justify-center font-black text-2xl text-white shadow-md">
                              {q.queueNumber}
                            </div>
                            <div>
                              <div className="font-bold text-lg text-gray-900">{q.studentId}</div>
                              <div className="text-sm text-gray-600 font-bold">{q.studentName || 'ไม่ระบุชื่อ'}</div>
                              <div className="text-xs text-gray-400 mt-1">กดจองเมื่อ: {formatTime(q.createdAt)} {i === 0 && <span className="ml-2 text-orange-500 font-bold">(คิวต่อไป)</span>}</div>
                            </div>
                          </div>
                          <button onClick={() => handleQueueAction(q.id, 'call')} disabled={actionLoading === q.id || !!queueData?.currentCalling} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${queueData?.currentCalling ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'}`}>
                            เรียกคิว
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-400 font-bold text-lg">
                      ไม่มีนักศึกษาต่อคิว
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: ตารางเวลา ─── */}
        {activeTab === 'schedule' && (
          <div className="white-card p-8 max-w-3xl mx-auto border-t-4 border-t-purple-500">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">ตั้งเวลาทำการของคุณ</h2>
              <p className="text-gray-500 text-sm font-bold">กำหนดวันและเวลาที่คุณสะดวกให้นักศึกษาเข้ามาปรึกษา เพื่อแสดงในหน้านักศึกษา</p>
            </div>
            
            <div className="space-y-4">
              {schedules.map((s, i) => (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border-2 transition-all ${s.isActive ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-center gap-4 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={s.isActive}
                        onChange={e => handleScheduleChange(i, 'isActive', e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </div>
                    <span className={`font-bold text-lg ${s.isActive ? 'text-purple-700' : 'text-gray-500'}`}>{DAY_NAMES[i]}</span>
                  </label>
                  
                  {s.isActive && (
                    <div className="flex items-center gap-3 mt-4 sm:mt-0">
                      <input type="time" value={s.startTime} onChange={e => handleScheduleChange(i, 'startTime', e.target.value)} className="input-clean py-2 px-3 w-32 text-center text-sm font-bold" />
                      <span className="text-gray-500 font-bold">ถึง</span>
                      <input type="time" value={s.endTime} onChange={e => handleScheduleChange(i, 'endTime', e.target.value)} className="input-clean py-2 px-3 w-32 text-center text-sm font-bold" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200 flex items-center justify-between">
              <span className={`text-sm font-bold ${scheduleMsg === 'บันทึกสำเร็จ' ? 'text-green-600' : 'text-red-500'}`}>
                {scheduleMsg}
              </span>
              <button onClick={saveSchedules} disabled={scheduleLoading} className="btn-primary w-auto px-8">
                {scheduleLoading ? 'กำลังบันทึก...' : 'บันทึกตารางเวลา'}
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: แก้ไขโปรไฟล์ ─── */}
        {activeTab === 'profile' && (
          <div className="white-card p-8 max-w-3xl mx-auto border-t-4 border-t-orange-500">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">ตั้งค่าโปรไฟล์</h2>
              <p className="text-gray-500 text-sm font-bold">แก้ไขชื่อ รายวิชา อิโมจิ หรือเปลี่ยนรหัสผ่านของคุณ</p>
            </div>
            
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ชื่ออาจารย์ <span className="text-red-500">*</span></label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="input-clean" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">รายวิชา / ตำแหน่ง</label>
                  <input type="text" value={profileData.title} onChange={e => setProfileData({...profileData, title: e.target.value})} className="input-clean" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">อิโมจิประจำตัว (ใส่ได้ 1 ตัว)</label>
                  <input type="text" value={profileData.emoji} onChange={e => setProfileData({...profileData, emoji: e.target.value})} className="input-clean text-2xl" maxLength={2} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ตั้งรหัสผ่านใหม่ (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)</label>
                  <input type="password" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} placeholder="ปล่อยว่างไว้เพื่อใช้รหัสเดิม" className="input-clean" />
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200 flex items-center justify-between">
                <span className={`text-sm font-bold ${profileMsg === 'อัปเดตข้อมูลสำเร็จ' ? 'text-green-600' : 'text-red-500'}`}>
                  {profileMsg}
                </span>
                <button type="submit" disabled={profileLoading} className="btn-primary w-auto px-8 bg-orange-600 hover:bg-orange-700 shadow-orange-500/30">
                  {profileLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
