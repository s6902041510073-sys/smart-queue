'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface Schedule {
  id: number
  teacherId: number
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
  isActive: boolean
  schedules: Schedule[]
  _count?: { queues: number }
}

interface QueueItem {
  id: number
  queueNumber: number
  studentId: string
  studentName: string
  teacherId: number
  status: string
  createdAt: string
  updatedAt: string
}

interface QueueData {
  queues: QueueItem[]
  currentCalling: QueueItem | null
  nextQueueNumber: number
  stats: { waiting: number; calling: number; completed: number; skipped: number }
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const STORAGE_KEY = 'smartqueue_booking'

export default function StudentPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [myQueueId, setMyQueueId] = useState<number | null>(null)
  const [myTeacherId, setMyTeacherId] = useState<number | null>(null)
  const [myQueue, setMyQueue] = useState<QueueItem | null>(null)
  const [position, setPosition] = useState(0)
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const detailRef = useRef<HTMLDivElement>(null)

  const today = new Date().getDay()
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

  const getTodaySchedule = (t: Teacher) =>
    t.schedules.filter((s) => s.dayOfWeek === today && s.isActive)

  const isAvailableNow = (t: Teacher) =>
    getTodaySchedule(t).some((s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em
    })

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers')
      if (!res.ok) return
      const data = await res.json()
      setTeachers(data.teachers)
    } catch {}
  }, [])

  const fetchQueueData = useCallback(async () => {
    const tid = selectedTeacher?.id ?? myTeacherId
    if (!tid) return
    try {
      const res = await fetch(`/api/queue?teacherId=${tid}`)
      if (!res.ok) return
      const data: QueueData = await res.json()
      setQueueData(data)

      if (myQueueId) {
        const mine = data.queues.find((q) => q.id === myQueueId)
        if (mine) {
          setMyQueue(mine)
          setPosition(data.queues.filter((q) => q.status === 'WAITING' && q.queueNumber < mine.queueNumber).length)
        } else {
          setMyQueue(null)
          setMyQueueId(null)
          setMyTeacherId(null)
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {}
  }, [selectedTeacher, myQueueId, myTeacherId])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { queueId, teacherId } = JSON.parse(saved)
        setMyQueueId(queueId)
        setMyTeacherId(teacherId)
      }
    } catch {}
  }, [])

  useEffect(() => { fetchTeachers() }, [fetchTeachers])

  useEffect(() => {
    fetchQueueData()
    const i = setInterval(fetchQueueData, 3000)
    return () => clearInterval(i)
  }, [fetchQueueData])

  useEffect(() => {
    if (myTeacherId && teachers.length > 0 && !selectedTeacher) {
      const t = teachers.find((t) => t.id === myTeacherId)
      if (t) setSelectedTeacher(t)
    }
  }, [myTeacherId, teachers, selectedTeacher])

  const selectTeacher = (t: Teacher) => {
    setSelectedTeacher(t)
    setError('')
    setSuccess('')
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacher) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName, teacherId: selectedTeacher.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setMyQueue(data.queue)
      setMyQueueId(data.queue.id)
      setMyTeacherId(selectedTeacher.id)
      setPosition(data.position)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ queueId: data.queue.id, teacherId: selectedTeacher.id }))
      setSuccess(`จองคิวสำเร็จ! คุณได้คิวที่ ${data.queue.queueNumber}`)
      setStudentId('')
      setStudentName('')
      fetchTeachers()
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const handleCancel = async () => {
    if (!myQueueId || !confirm('ยืนยันการยกเลิกคิว?')) return
    try {
      await fetch(`/api/queue/${myQueueId}`, { method: 'DELETE' })
      setMyQueue(null)
      setMyQueueId(null)
      setMyTeacherId(null)
      localStorage.removeItem(STORAGE_KEY)
      setSuccess('')
      fetchQueueData()
      fetchTeachers()
    } catch {}
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans pb-20">
      {/* ─── Futuristic Background ─── */}
      <div className="fixed inset-0 z-[-2] bg-grid opacity-30" />
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px] animate-pulse-glow z-[-1]" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/10 blur-[100px] animate-pulse-glow z-[-1]" style={{ animationDelay: '2s' }} />
      <div className="fixed w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent top-0 animate-scanline z-[-1]" />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 glass-panel border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                🚀
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wider text-white">SMART<span className="text-gradient-neon">QUEUE</span></h1>
                <p className="text-gray-400 text-xs tracking-widest uppercase">Student Portal</p>
              </div>
            </div>
            <Link href="/teacher" className="text-xs font-semibold px-5 py-2.5 rounded-lg border border-gray-700 hover:border-cyan-500 text-gray-300 hover:text-cyan-400 transition-all bg-gray-900/50">
              TEACHER LOGIN
            </Link>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* ─── เลือกอาจารย์ ─── */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#00f0ff]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">SELECT INSTRUCTOR</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map((t) => {
              const todaySchedules = getTodaySchedule(t)
              const available = isAvailableNow(t)
              const selected = selectedTeacher?.id === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => selectTeacher(t)}
                  className={`glass-panel rounded-2xl p-6 cursor-pointer group ${selected ? 'glass-card-active' : ''}`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      {t.emoji}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${available ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse' : 'bg-gray-600'}`} />
                        <span className={`text-xs font-bold tracking-wider uppercase ${available ? 'text-cyan-400' : 'text-gray-500'}`}>
                          {available ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                      {(t._count?.queues ?? 0) > 0 && (
                        <div className="text-xs font-semibold text-gray-400">
                          WAITING: <span className="text-white">{t._count?.queues}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xl text-white mb-1">{t.name}</h3>
                    <p className="text-sm text-gray-400 mb-6">{t.title}</p>
                  </div>

                  <div className="space-y-3 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">TODAY ({DAY_NAMES[today]})</p>
                    {todaySchedules.length > 0 ? (
                      todaySchedules.map((s, i) => (
                        <div key={i} className="text-sm font-mono text-cyan-300">
                          {s.startTime} <span className="text-gray-600">—</span> {s.endTime}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600 font-mono">NO SCHEDULE</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── Detail Section ─── */}
        {selectedTeacher && (
          <section ref={detailRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Teacher Info & Schedule */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel rounded-2xl p-6 border-t-2 border-t-cyan-500">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">{selectedTeacher.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg text-white">{selectedTeacher.name}</h3>
                    <p className="text-cyan-400 text-xs tracking-wider">{selectedTeacher.title}</p>
                  </div>
                </div>
                
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">WEEKLY SCHEDULE</h4>
                <div className="space-y-2">
                  {DAY_SHORT.map((d, i) => {
                    const daySchedules = selectedTeacher.schedules.filter((s) => s.dayOfWeek === i && s.isActive)
                    const isToday = i === today
                    return (
                      <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-xs font-mono ${isToday ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300' : 'text-gray-400'}`}>
                        <span className="font-bold">{d}</span>
                        {daySchedules.length > 0 ? (
                          <div className="text-right">
                            {daySchedules.map((s, j) => <div key={j}>{s.startTime} - {s.endTime}</div>)}
                          </div>
                        ) : (
                          <span className="text-gray-600">-- : --</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stats */}
              {queueData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-l-cyan-500">
                    <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">WAITING</div>
                    <div className="text-2xl font-bold text-white">{queueData.stats.waiting}</div>
                  </div>
                  <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-l-purple-500">
                    <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">COMPLETED</div>
                    <div className="text-2xl font-bold text-white">{queueData.stats.completed}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Active Queue & Booking */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Current Calling Panel */}
              <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_15px_#00f0ff]" />
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" /> CURRENTLY SERVING
                </h4>
                
                {queueData?.currentCalling ? (
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 rounded-2xl bg-gray-900 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-float">
                      <span className="text-6xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                    </div>
                    <div className="text-center md:text-left">
                      <div className="text-gray-400 text-sm tracking-widest uppercase mb-1">Student ID</div>
                      <div className="text-3xl font-bold text-white mb-2">{queueData.currentCalling.studentId}</div>
                      {queueData.currentCalling.studentName && (
                        <div className="text-xl text-cyan-300">{queueData.currentCalling.studentName}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 font-mono">
                    [ NO ACTIVE QUEUE ]
                  </div>
                )}
              </div>

              {/* My Queue / Booking Form */}
              {myQueue && myTeacherId === selectedTeacher.id ? (
                <div className={`glass-panel rounded-2xl p-8 relative overflow-hidden transition-all duration-500 ${myQueue.status === 'CALLING' ? 'border border-cyan-400 shadow-[0_0_40px_rgba(0,240,255,0.3)]' : ''}`}>
                  {myQueue.status === 'CALLING' && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />}
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    YOUR TICKET
                  </h4>
                  <div className="flex flex-col items-center text-center">
                    <div className="text-[10px] text-gray-500 tracking-widest uppercase mb-2">TICKET NO.</div>
                    <div className="text-8xl font-black text-gradient-neon mb-6">{myQueue.queueNumber}</div>
                    
                    {myQueue.status === 'CALLING' ? (
                      <div className="px-6 py-3 bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 rounded-xl font-bold tracking-widest animate-pulse">
                        PLEASE PROCEED TO INSTRUCTOR
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-gray-400 font-mono">
                          WAITING POSITION: <span className="text-white text-xl ml-2">{position}</span>
                        </div>
                        {myQueue.status === 'WAITING' && (
                          <button onClick={handleCancel} className="mt-4 px-6 py-2 text-xs font-bold text-red-400 hover:text-white border border-red-900 hover:bg-red-900/50 rounded-lg transition-all tracking-widest">
                            CANCEL TICKET
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : !myQueue ? (
                <div className="glass-panel rounded-2xl p-8">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    REQUEST CONSULTATION
                  </h4>
                  <form onSubmit={handleBook} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 tracking-widest mb-2">STUDENT ID *</label>
                      <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. 65001234" className="input-cyber font-mono text-lg" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 tracking-widest mb-2">NAME (OPTIONAL)</label>
                      <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="John Doe" className="input-cyber" />
                    </div>
                    {error && <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-mono">{error}</div>}
                    <button type="submit" disabled={loading} className="btn-neon w-full py-4 rounded-xl font-bold tracking-widest text-lg disabled:opacity-50 mt-4">
                      {loading ? 'PROCESSING...' : 'GET TICKET'}
                    </button>
                  </form>
                </div>
              ) : (
                 <div className="glass-panel rounded-2xl p-8 text-center text-gray-500 font-mono text-sm">
                   YOU ALREADY HAVE AN ACTIVE TICKET WITH ANOTHER INSTRUCTOR.
                 </div>
              )}

            </div>
          </section>
        )}
      </main>
      
      <footer className="fixed bottom-0 left-0 w-full p-4 text-center z-40 bg-gray-950/80 backdrop-blur-md border-t border-gray-800">
        <div className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" /> SYSTEM AUTO-SYNC ACTIVE
        </div>
      </footer>
    </div>
  )
}
