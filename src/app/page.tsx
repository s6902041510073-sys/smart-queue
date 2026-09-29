'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import ConfirmModal from '@/components/ConfirmModal'

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
  const [showCancelModal, setShowCancelModal] = useState(false)

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

  // ─── Fetch teachers ───
  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers')
      if (!res.ok) return
      const data = await res.json()
      setTeachers(data.teachers)
    } catch {}
  }, [])

  // ─── Fetch queue data for selected teacher ───
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

  // ─── Load booking from localStorage ───
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

  // ─── Auto-select teacher if has booking ───
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
    if (!myQueueId) return
    setShowCancelModal(true)
  }

  const confirmCancel = async () => {
    if (!myQueueId) return
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
    setShowCancelModal(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute top-1/3 -right-20 w-[28rem] h-[28rem] bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25" />
      <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />

      {/* ═══ Header ═══ */}
      <header className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-b-[2.5rem]">
        <div className="max-w-5xl mx-auto px-5 py-7">
          <div className="flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm">🎫</div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Smart Queue</h1>
                <p className="text-indigo-200 text-sm">ระบบบัตรคิวตรวจงานและปรึกษาอาจารย์</p>
              </div>
            </div>
            <Link href="/teacher" className="glass-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/20 transition-all">
              ครูผู้สอน →
            </Link>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 py-8 space-y-8">
        {/* ═══ เลือกอาจารย์ ═══ */}
        <section className="animate-fade-in-up animate-delay-1">
          <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            👨‍🏫 เลือกอาจารย์ที่ต้องการพบ
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => {
              const todaySchedules = getTodaySchedule(t)
              const available = isAvailableNow(t)
              const selected = selectedTeacher?.id === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => selectTeacher(t)}
                  className={`teacher-card ${selected ? 'selected ring-2 ring-indigo-500 shadow-xl' : ''}`}
                >
                  {/* Emoji + Name */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-200/50 shrink-0">
                      {t.emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 truncate">{t.name}</h3>
                      <p className="text-sm text-gray-400 truncate">{t.title}</p>
                    </div>
                  </div>

                  {/* Today's schedule */}
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📅 ตารางวันนี้ ({DAY_NAMES[today]})</p>
                    {todaySchedules.length > 0 ? (
                      todaySchedules.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-indigo-600 font-semibold">{s.startTime} - {s.endTime}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-300">ไม่มีตารางวันนี้</p>
                    )}
                  </div>

                  {/* Status + Queue count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${available ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-medium ${available ? 'text-green-600' : 'text-gray-400'}`}>
                        {available ? 'เปิดรับตอนนี้' : 'ปิดรับ'}
                      </span>
                    </div>
                    {(t._count?.queues ?? 0) > 0 && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                        ⏳ {t._count?.queues} คิว
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ═══ Detail Section (when teacher selected) ═══ */}
        {selectedTeacher && (
          <section ref={detailRef} className="space-y-6 animate-fade-in-up">
            {/* Teacher info + full schedule */}
            <div className="glass rounded-3xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedTeacher.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg">{selectedTeacher.name}</h3>
                    <p className="text-indigo-200 text-sm">{selectedTeacher.title}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📅 ตารางทั้งสัปดาห์</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_SHORT.map((d, i) => {
                    const daySchedules = selectedTeacher.schedules.filter((s) => s.dayOfWeek === i && s.isActive)
                    const isToday = i === today
                    return (
                      <div key={i} className={`rounded-xl p-2 text-center text-xs ${isToday ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'bg-gray-50'}`}>
                        <div className={`font-bold mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>{d}</div>
                        {daySchedules.length > 0 ? (
                          daySchedules.map((s, j) => (
                            <div key={j} className="text-[10px] text-gray-600 leading-tight">{s.startTime}-{s.endTime}</div>
                          ))
                        ) : (
                          <div className="text-[10px] text-gray-300">—</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Current calling */}
            <div className="glass rounded-3xl shadow-lg overflow-hidden">
              <div className="px-6 py-3.5 border-b border-white/50 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">คิวที่กำลังเรียก</h2>
              </div>
              <div className="px-6 py-8 text-center">
                {queueData?.currentCalling ? (
                  <div className="animate-bounce-in">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-200/50 mb-3 animate-float">
                      <span className="text-5xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                    </div>
                    <p className="text-gray-600 font-medium">
                      {queueData.currentCalling.studentId}
                      {queueData.currentCalling.studentName && <span className="text-gray-400"> — {queueData.currentCalling.studentName}</span>}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      กำลังตรวจงาน
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-2"><span className="text-2xl">🕐</span></div>
                    <p className="text-gray-400 text-sm">ยังไม่มีการเรียกคิว</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            {queueData && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'รอเรียก', v: queueData.stats.waiting, icon: '⏳', g: 'from-amber-400 to-orange-500' },
                  { l: 'กำลังตรวจ', v: queueData.stats.calling, icon: '📋', g: 'from-emerald-400 to-green-500' },
                  { l: 'ตรวจแล้ว', v: queueData.stats.completed, icon: '✅', g: 'from-blue-400 to-indigo-500' },
                ].map((s) => (
                  <div key={s.l} className="glass rounded-2xl p-4 text-center hover:scale-105 transition-transform">
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${s.g} shadow-md mb-1.5`}>
                      <span className="text-white text-xs">{s.icon}</span>
                    </div>
                    <div className="text-xl font-bold text-gray-800">{s.v}</div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── My Queue or Booking Form ─── */}
            {myQueue && myTeacherId === selectedTeacher.id ? (
              <div className={`rounded-3xl overflow-hidden transition-all duration-500 ${
                myQueue.status === 'CALLING' ? 'glow-green animate-pulse-ring' : 'shadow-lg'
              }`}>
                <div className={`px-6 py-4 text-white ${
                  myQueue.status === 'CALLING' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                }`}>
                  <span className="text-xl mr-2">{myQueue.status === 'CALLING' ? '🔔' : '🎫'}</span>
                  <span className="font-bold text-lg">{myQueue.status === 'CALLING' ? 'ถึงคิวคุณแล้ว!' : 'บัตรคิวของคุณ'}</span>
                </div>
                <div className={`px-6 py-8 ${myQueue.status === 'CALLING' ? 'bg-green-50' : 'bg-white'}`}>
                  <div className="ticket border-b-2 border-dashed border-gray-200 pb-6 mb-6 mx-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">หมายเลขคิว</p>
                      <div className={`text-7xl font-black ${myQueue.status === 'CALLING' ? 'text-green-600' : 'gradient-text'}`}>
                        {myQueue.queueNumber}
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    {myQueue.status === 'CALLING' ? (
                      <p className="text-green-700 font-semibold text-lg animate-pulse">📢 กรุณาเดินมาที่โต๊ะอาจารย์</p>
                    ) : (
                      <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium mb-2">
                          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" /> รอเรียก
                        </div>
                        <p className="text-gray-500">มี <span className="text-2xl font-bold text-indigo-600 mx-1">{position}</span> คิวก่อนหน้าคุณ</p>
                      </div>
                    )}
                    {myQueue.status === 'WAITING' && (
                      <button onClick={handleCancel} className="mt-6 px-6 py-2.5 text-red-500 border-2 border-red-200 rounded-2xl hover:bg-red-50 transition-all text-sm font-medium">
                        ✕ ยกเลิกคิว
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : !myQueue ? (
              <div className="glass rounded-3xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-xl">📝</span>
                    <div>
                      <h2 className="font-bold text-lg">จองคิวตรวจงาน</h2>
                      <p className="text-indigo-200 text-sm">กับ{selectedTeacher.name}</p>
                    </div>
                  </div>
                </div>
                <form onSubmit={handleBook} className="px-6 py-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">รหัสนักศึกษา <span className="text-red-400">*</span></label>
                    <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="เช่น 65001234" className="input-modern text-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">ชื่อ-นามสกุล <span className="text-gray-300 font-normal">(ไม่บังคับ)</span></label>
                    <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="เช่น สมชาย ใจดี" className="input-modern" />
                  </div>
                  {error && <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm animate-slide-down">⚠️ {error}</div>}
                  {success && <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-600 text-sm animate-slide-down">🎉 {success}</div>}
                  <button type="submit" disabled={loading} className="gradient-btn w-full py-4 text-white rounded-2xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <span>{loading ? '⏳ กำลังจอง...' : '🎫 จองคิว'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass rounded-3xl p-6 text-center text-gray-400 text-sm">
                คุณมีคิวกับอาจารย์ท่านอื่นอยู่ กรุณายกเลิกก่อนจึงจะจองคิวใหม่ได้
              </div>
            )}

            {/* Waiting list */}
            {queueData && queueData.queues.filter((q) => q.status === 'WAITING').length > 0 && (
              <div className="glass rounded-3xl shadow-lg overflow-hidden">
                <div className="px-6 py-3.5 border-b border-white/50 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-600 text-sm flex items-center gap-2">📋 คิวที่รออยู่</h2>
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full font-semibold">
                    {queueData.queues.filter((q) => q.status === 'WAITING').length} คิว
                  </span>
                </div>
                <div className="divide-y divide-gray-100/50">
                  {queueData.queues.filter((q) => q.status === 'WAITING').map((q) => (
                    <div key={q.id} className={`px-6 py-3.5 flex items-center justify-between ${q.id === myQueueId ? 'bg-indigo-50/70' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                          q.id === myQueueId ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                        }`}>{q.queueNumber}</div>
                        <span className="text-gray-700 text-sm font-medium">
                          {q.studentId}{q.studentName && <span className="text-gray-400 font-normal"> — {q.studentName}</span>}
                        </span>
                      </div>
                      {q.id === myQueueId && <span className="text-[10px] bg-indigo-500 text-white px-2.5 py-0.5 rounded-full font-bold uppercase">คุณ</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="relative text-center py-6">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          อัปเดตอัตโนมัติทุก 3 วินาที
        </div>
      </footer>

      <ConfirmModal
        isOpen={showCancelModal}
        title="ยกเลิกคิว"
        message="ต้องการยกเลิกคิวใช่หรือไม่? ข้อมูลคิวของคุณจะถูกลบ"
        confirmText="ยืนยัน"
        cancelText="ยกเลิก"
        onConfirm={confirmCancel}
        onCancel={() => setShowCancelModal(false)}
      />
    </div>
  )
}
