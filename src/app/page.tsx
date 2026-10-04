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
    <div className="min-h-screen bg-black relative font-sans pb-20">
      
      {/* ─── เอฟเฟกต์หิมะตก ─── */}
      <div className="snow-container">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="snowflake" />
        ))}
      </div>

      {/* ─── ส่วนหัวของเว็บ (Header) ─── */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                🎓
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ระบบสมาร์ทคิว</h1>
                <p className="text-gray-400 text-xs">สำหรับนักศึกษา</p>
              </div>
            </div>
            <Link href="/teacher" className="text-xs font-bold px-5 py-2.5 rounded-lg border border-gray-700 hover:border-white text-gray-300 hover:text-white transition-all bg-gray-900">
              เข้าสู่ระบบอาจารย์
            </Link>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12 space-y-12 z-10">
        
        {/* ─── เลือกอาจารย์ ─── */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-blue-500 rounded-full" />
            <h2 className="text-2xl font-bold text-white">เลือกอาจารย์ที่ต้องการพบ</h2>
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
                  className={`white-card cursor-pointer group p-6 ${selected ? 'white-card-active' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
                      {t.emoji}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${available ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <span className={`text-xs font-bold ${available ? 'text-green-600' : 'text-gray-500'}`}>
                          {available ? 'ว่าง / เปิดรับคิว' : 'ไม่อยู่'}
                        </span>
                      </div>
                      {(t._count?.queues ?? 0) > 0 && (
                        <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                          รอคิวอยู่: {t._count?.queues} คน
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xl text-gray-900 mb-1">{t.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{t.title}</p>
                  </div>

                  <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500">ตารางเวลาวันนี้ ({DAY_NAMES[today]})</p>
                    {todaySchedules.length > 0 ? (
                      todaySchedules.map((s, i) => (
                        <div key={i} className="text-sm font-bold text-gray-800">
                          {s.startTime} <span className="text-gray-400">—</span> {s.endTime}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-red-500 font-bold">ไม่มีตารางเข้าพบวันนี้</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── ส่วนรายละเอียดและการจองคิว ─── */}
        {selectedTeacher && (
          <section ref={detailRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* คอลัมน์ซ้าย: ตารางเวลาทั้งสัปดาห์ */}
            <div className="lg:col-span-1 space-y-6">
              <div className="white-card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">{selectedTeacher.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{selectedTeacher.name}</h3>
                    <p className="text-gray-500 text-xs">{selectedTeacher.title}</p>
                  </div>
                </div>
                
                <h4 className="text-xs font-bold text-gray-400 mb-3 border-b pb-2">ตารางเวลาทั้งสัปดาห์</h4>
                <div className="space-y-3">
                  {DAY_SHORT.map((d, i) => {
                    const daySchedules = selectedTeacher.schedules.filter((s) => s.dayOfWeek === i && s.isActive)
                    const isToday = i === today
                    return (
                      <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-xs ${isToday ? 'bg-blue-100 text-blue-800 font-bold border border-blue-200' : 'text-gray-600'}`}>
                        <span>{d}</span>
                        {daySchedules.length > 0 ? (
                          <div className="text-right">
                            {daySchedules.map((s, j) => <div key={j}>{s.startTime} - {s.endTime}</div>)}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* สถิติ */}
              {queueData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="white-card p-4 text-center">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">กำลังรอคิว</div>
                    <div className="text-2xl font-black text-blue-600">{queueData.stats.waiting}</div>
                  </div>
                  <div className="white-card p-4 text-center">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">ตรวจเสร็จแล้ว</div>
                    <div className="text-2xl font-black text-green-600">{queueData.stats.completed}</div>
                  </div>
                </div>
              )}
            </div>

            {/* คอลัมน์ขวา: การจองคิว และ คิวปัจจุบัน */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* ป้ายแสดงคิวที่กำลังเรียก */}
              <div className="white-card p-8 border-l-4 border-l-green-500">
                <h4 className="text-sm font-bold text-green-600 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> คิวที่กำลังเรียกให้ไปพบ
                </h4>
                
                {queueData?.currentCalling ? (
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg animate-float">
                      <span className="text-6xl font-black text-white">{queueData.currentCalling.queueNumber}</span>
                    </div>
                    <div className="text-center md:text-left">
                      <div className="text-gray-500 text-sm font-bold mb-1">รหัสนักศึกษา</div>
                      <div className="text-3xl font-black text-gray-900 mb-2">{queueData.currentCalling.studentId}</div>
                      {queueData.currentCalling.studentName && (
                        <div className="text-xl text-blue-600 font-bold">{queueData.currentCalling.studentName}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 font-bold">
                    ยังไม่มีการเรียกคิวในขณะนี้
                  </div>
                )}
              </div>

              {/* ฟอร์มจองคิว / ตั๋วคิวของฉัน */}
              {myQueue && myTeacherId === selectedTeacher.id ? (
                <div className={`white-card p-8 text-center transition-all duration-500 ${myQueue.status === 'CALLING' ? 'border-4 border-green-400 bg-green-50' : ''}`}>
                  <h4 className="text-sm font-bold text-gray-800 mb-2">
                    ตั๋วคิวของคุณ
                  </h4>
                  <div className="text-gray-500 text-xs mb-6">รหัสนักศึกษา: {myQueue.studentId}</div>
                  
                  <div className="text-8xl font-black text-blue-600 mb-6 drop-shadow-md">{myQueue.queueNumber}</div>
                  
                  {myQueue.status === 'CALLING' ? (
                    <div className="px-6 py-4 bg-green-600 text-white rounded-xl font-bold text-xl shadow-lg animate-pulse">
                      ถึงคิวของคุณแล้ว! กรุณาเดินมาที่โต๊ะอาจารย์
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-gray-600 font-bold bg-gray-100 py-3 rounded-lg">
                        มีคิวรออยู่ก่อนหน้าคุณ: <span className="text-blue-600 text-xl mx-2">{position}</span> คิว
                      </div>
                      {myQueue.status === 'WAITING' && (
                        <button onClick={handleCancel} className="mt-4 text-sm font-bold text-red-500 hover:text-red-700 underline transition-all">
                          ยกเลิกคิวนี้
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : !myQueue ? (
                <div className="white-card p-8">
                  <h4 className="text-lg font-bold text-gray-900 mb-6">
                    กรอกข้อมูลเพื่อจองคิว
                  </h4>
                  <form onSubmit={handleBook} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">รหัสนักศึกษา <span className="text-red-500">*</span></label>
                      <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="เช่น 65001234" className="input-clean" required />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อ-นามสกุล (ไม่บังคับ)</label>
                      <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="เช่น สมชาย ใจดี" className="input-clean" />
                    </div>
                    {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold">{error}</div>}
                    <button type="submit" disabled={loading} className="btn-primary">
                      {loading ? 'กำลังประมวลผล...' : 'กดรับบัตรคิว'}
                    </button>
                  </form>
                </div>
              ) : (
                 <div className="white-card p-8 text-center text-gray-500 font-bold">
                   คุณได้จองคิวกับอาจารย์ท่านอื่นไว้แล้ว ไม่สามารถจองซ้อนได้ครับ
                 </div>
              )}

            </div>
          </section>
        )}
      </main>
      
      <footer className="fixed bottom-0 left-0 w-full p-4 text-center z-40 bg-black/90 backdrop-blur-md border-t border-gray-800">
        <div className="text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> ระบบอัปเดตข้อมูลอัตโนมัติทุก 3 วินาที
        </div>
      </footer>
    </div>
  )
}
