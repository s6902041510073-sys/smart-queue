'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';

// Types
type Schedule = {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type Teacher = {
  id: number;
  name: string;
  title: string;
  emoji: string;
  schedules?: Schedule[];
};

type QueueItem = {
  id: number;
  queueNumber: string;
  studentName: string;
  studentId: string;
  status: 'waiting' | 'calling' | 'completed' | 'skipped';
  createdAt: string;
  updatedAt: string;
};

type QueueStats = {
  waiting: number;
  calling: number;
  completed: number;
  skipped: number;
};

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export default function TeacherDashboard() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'queue' | 'schedule'>('queue');
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [currentCalling, setCurrentCalling] = useState<QueueItem | null>(null);
  const [stats, setStats] = useState<QueueStats>({ waiting: 0, calling: 0, completed: 0, skipped: 0 });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Schedule state
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  // Initial load
  useEffect(() => {
    fetchTeachers();
    
    const storedTeacher = sessionStorage.getItem('smartqueue_teacher');
    if (storedTeacher) {
      try {
        const teacher = JSON.parse(storedTeacher);
        setCurrentTeacher(teacher);
        setIsAuthenticated(true);
        initSchedules(teacher.schedules || []);
      } catch (e) {
        sessionStorage.removeItem('smartqueue_teacher');
      }
    }
  }, []);

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/teachers');
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers);
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
    }
  };

  const initSchedules = (existingSchedules: Schedule[]) => {
    const newSchedules = DAY_NAMES.map((_, index) => {
      const existing = existingSchedules.find(s => s.dayOfWeek === index);
      if (existing) {
        return existing;
      }
      return {
        dayOfWeek: index,
        startTime: '08:00',
        endTime: '16:00',
        isActive: false
      };
    });
    setSchedules(newSchedules);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      setAuthError('กรุณาเลือกอาจารย์');
      return;
    }
    if (!password) {
      setAuthError('กรุณากรอกรหัสผ่าน');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacherId, password })
      });
      
      const data = await res.json();
      
      if (data.success && data.teacher) {
        setCurrentTeacher(data.teacher);
        setIsAuthenticated(true);
        sessionStorage.setItem('smartqueue_teacher', JSON.stringify(data.teacher));
        initSchedules(data.teacher.schedules || []);
      } else {
        setAuthError(data.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      setAuthError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentTeacher(null);
    setSelectedTeacherId(null);
    setPassword('');
    sessionStorage.removeItem('smartqueue_teacher');
  };

  const fetchQueueData = useCallback(async () => {
    if (!currentTeacher) return;
    
    try {
      const res = await fetch(`/api/queue?teacherId=${currentTeacher.id}`);
      if (res.ok) {
        const data = await res.json();
        setQueues(data.queues || []);
        setCurrentCalling(data.currentCalling || null);
        if (data.stats) setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    }
  }, [currentTeacher]);

  // Polling for queue data
  useEffect(() => {
    if (isAuthenticated && activeTab === 'queue') {
      fetchQueueData();
      const interval = setInterval(fetchQueueData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab, fetchQueueData]);

  const handleQueueAction = async (id: number, action: 'call' | 'complete' | 'skip') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        await fetchQueueData();
      }
    } catch (error) {
      console.error(`Failed to ${action} queue:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetQueue = async () => {
    if (!currentTeacher) return;
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    if (!currentTeacher) return;
    try {
      const res = await fetch('/api/queue/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: currentTeacher.id })
      });
      if (res.ok) {
        await fetchQueueData();
      }
    } catch (error) {
      console.error('Failed to reset queue:', error);
    }
    setShowResetModal(false);
  };

  const handleScheduleChange = (index: number, field: keyof Schedule, value: any) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setSchedules(newSchedules);
  };

  const saveSchedules = async () => {
    if (!currentTeacher) return;
    setScheduleLoading(true);
    setScheduleMessage('');
    
    try {
      const res = await fetch(`/api/teachers/${currentTeacher.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules);
        
        // Update teacher in state/storage with new schedules
        const updatedTeacher = { ...currentTeacher, schedules: data.schedules };
        setCurrentTeacher(updatedTeacher);
        sessionStorage.setItem('smartqueue_teacher', JSON.stringify(updatedTeacher));
        
        setScheduleMessage('บันทึกตารางเวลาเรียบร้อยแล้ว');
        setTimeout(() => setScheduleMessage(''), 3000);
      } else {
        setScheduleMessage('เกิดข้อผิดพลาดในการบันทึกตารางเวลา');
      }
    } catch (error) {
      setScheduleMessage('เกิดข้อผิดพลาดในการบันทึกตารางเวลา');
    } finally {
      setScheduleLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 relative overflow-hidden flex items-center justify-center p-4">
        {/* Decorative blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-200/30 blur-3xl mix-blend-multiply animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-200/30 blur-3xl mix-blend-multiply animate-float animate-delay-2"></div>
        
        <div className="w-full max-w-2xl z-10 animate-scale-in">
          <div className="glass rounded-3xl p-8 shadow-xl border border-white/50">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">เข้าสู่ระบบ</h1>
              <p className="text-gray-500">สำหรับอาจารย์เพื่อจัดการคิวและตารางเวลา</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-4">เลือกอาจารย์</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {teachers.map((teacher, index) => (
                    <div
                      key={teacher.id}
                      onClick={() => setSelectedTeacherId(teacher.id)}
                      className={`cursor-pointer rounded-2xl p-4 transition-all duration-300 flex flex-col items-center text-center animate-fade-in-up ${
                        selectedTeacherId === teacher.id
                          ? 'bg-amber-100 ring-2 ring-amber-500 shadow-md scale-105'
                          : 'bg-white/60 hover:bg-white/90 border border-gray-100 hover:shadow-sm'
                      }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="text-4xl mb-2">{teacher.emoji}</div>
                      <div className="font-semibold text-gray-800 text-sm">{teacher.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{teacher.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTeacherId && (
                <div className="mb-8 animate-slide-down">
                  <label className="block text-sm font-medium text-gray-700 mb-2">รหัสผ่าน</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-modern-warm w-full"
                    placeholder="กรุณากรอกรหัสผ่าน"
                    autoFocus
                  />
                  {authError && <p className="text-red-500 text-sm mt-2">{authError}</p>}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={!selectedTeacherId || !password || authLoading}
                  className="gradient-btn-warm w-full py-3 rounded-xl font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {authLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
                <Link href="/" className="text-center text-gray-500 hover:text-amber-600 text-sm transition-colors">
                  ← กลับไปหน้าหลัก (สำหรับนักศึกษา)
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 relative overflow-hidden pb-20">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-200/30 blur-3xl mix-blend-multiply animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-200/30 blur-3xl mix-blend-multiply animate-float animate-delay-2"></div>
      
      {/* Header */}
      <header className="glass shadow-sm sticky top-0 z-50 mb-8 border-b border-white/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-2xl shadow-sm border border-amber-200">
              {currentTeacher?.emoji}
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text-warm">{currentTeacher?.name}</h1>
              <p className="text-sm text-gray-500">{currentTeacher?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-600 hover:text-amber-600 hidden md:block">
              ดูหน้าจอผู้ใช้
            </Link>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium border border-red-100"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white/40 p-1.5 rounded-2xl backdrop-blur-sm border border-white/60 inline-flex shadow-sm">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'queue' 
                ? 'gradient-btn-warm text-white shadow-md' 
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            📋 จัดการคิว
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'schedule' 
                ? 'gradient-btn-warm text-white shadow-md' 
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            📅 ตารางเวลา
          </button>
        </div>

        {/* Tab Content: Queue Management */}
        {activeTab === 'queue' && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass rounded-2xl p-5 border border-white/60 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                  ⏳
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{stats.waiting}</div>
                  <div className="text-sm text-gray-500">รอคิว</div>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 border border-white/60 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl animate-pulse">
                  📢
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{stats.calling}</div>
                  <div className="text-sm text-gray-500">กำลังเรียก</div>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 border border-white/60 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xl">
                  ✅
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{stats.completed}</div>
                  <div className="text-sm text-gray-500">เสร็จสิ้น</div>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 border border-white/60 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl">
                  ❌
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{stats.skipped}</div>
                  <div className="text-sm text-gray-500">ข้าม</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Currently Calling */}
              <div className="md:col-span-1">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📢</span> กำลังเรียก
                </h2>
                
                {currentCalling ? (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 border border-green-200 shadow-lg glow-green relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-200 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <div className="text-center mb-6 relative z-10">
                      <div className="text-5xl font-black text-green-600 mb-2 drop-shadow-sm">{currentCalling.queueNumber}</div>
                      <div className="text-xl font-bold text-gray-800">{currentCalling.studentName}</div>
                      <div className="text-gray-500">{currentCalling.studentId}</div>
                    </div>
                    <div className="flex gap-3 relative z-10">
                      <button 
                        onClick={() => handleQueueAction(currentCalling.id, 'complete')}
                        disabled={actionLoading === currentCalling.id}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                      >
                        เสร็จสิ้น
                      </button>
                      <button 
                        onClick={() => handleQueueAction(currentCalling.id, 'skip')}
                        disabled={actionLoading === currentCalling.id}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-medium transition-colors border border-gray-200 shadow-sm disabled:opacity-50"
                      >
                        ข้ามคิว
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-3xl p-8 text-center border border-white/60 text-gray-400">
                    <div className="text-4xl mb-4">💤</div>
                    <p>ไม่มีคิวที่กำลังเรียก</p>
                  </div>
                )}
              </div>

              {/* Waiting List */}
              <div className="md:col-span-2">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>⏳</span> คิวที่รอ ({stats.waiting})
                </h2>
                
                <div className="glass rounded-3xl p-4 border border-white/60 min-h-[300px]">
                  {queues.filter(q => q.status === 'waiting').length > 0 ? (
                    <div className="space-y-3">
                      {queues
                        .filter(q => q.status === 'waiting')
                        .map((queue) => (
                          <div key={queue.id} className="bg-white/60 hover:bg-white/80 rounded-2xl p-4 flex items-center justify-between transition-colors border border-white">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-xl border border-amber-200 shadow-inner">
                                {queue.queueNumber}
                              </div>
                              <div>
                                <div className="font-bold text-gray-800">{queue.studentName}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                  <span>{queue.studentId}</span>
                                  <span>•</span>
                                  <span>{formatDate(queue.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleQueueAction(queue.id, 'call')}
                              disabled={currentCalling !== null || actionLoading === queue.id}
                              className={`px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                                currentCalling !== null
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-md'
                              }`}
                            >
                              เรียกคิว
                            </button>
                          </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                      <div className="text-5xl mb-4">✨</div>
                      <p>ไม่มีคิวรอดำเนินการ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reset Queue Area */}
            <div className="mt-12 p-6 glass rounded-2xl border border-red-100/50 bg-red-50/30 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-red-800 mb-1">ล้างข้อมูลคิว</h3>
                <p className="text-sm text-red-600/80">ลบข้อมูลคิวทั้งหมดของวันนี้ (ไม่สามารถกู้คืนได้)</p>
              </div>
              <button 
                onClick={handleResetQueue}
                className="px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-colors shadow-sm"
              >
                ล้างคิวทั้งหมด
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Schedule Management */}
        {activeTab === 'schedule' && (
          <div className="glass rounded-3xl p-6 md:p-8 border border-white/60 animate-fade-in-up">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">จัดการตารางเวลา</h2>
                <p className="text-gray-500 text-sm">กำหนดเวลาทำการในแต่ละวัน</p>
              </div>
              {scheduleMessage && (
                <div className="px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium border border-green-100 animate-bounce-in">
                  {scheduleMessage}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200/50">
                    <th className="py-3 px-4 font-semibold text-gray-600">วัน</th>
                    <th className="py-3 px-4 font-semibold text-gray-600">สถานะ</th>
                    <th className="py-3 px-4 font-semibold text-gray-600">เวลาเริ่ม</th>
                    <th className="py-3 px-4 font-semibold text-gray-600">เวลาสิ้นสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule, index) => (
                    <tr key={index} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                      <td className="py-4 px-4 font-medium text-gray-800">
                        {DAY_NAMES[schedule.dayOfWeek]}
                      </td>
                      <td className="py-4 px-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={schedule.isActive}
                            onChange={(e) => handleScheduleChange(index, 'isActive', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                          disabled={!schedule.isActive}
                          className="input-modern-warm px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                          disabled={!schedule.isActive}
                          className="input-modern-warm px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:bg-gray-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={saveSchedules}
                disabled={scheduleLoading}
                className="gradient-btn-warm px-8 py-3 rounded-xl font-medium text-white shadow-md disabled:opacity-50 transition-all hover:shadow-lg"
              >
                {scheduleLoading ? 'กำลังบันทึก...' : 'บันทึกตารางเวลา'}
              </button>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer Update Indicator */}
      {isAuthenticated && activeTab === 'queue' && lastUpdated && (
        <div className="fixed bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-white backdrop-blur-sm z-50">
          อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
        </div>
      )}

      <ConfirmModal
        isOpen={showResetModal}
        title="ล้างคิวทั้งหมด"
        message="คุณแน่ใจหรือไม่ที่จะล้างคิวทั้งหมด? ข้อมูลคิวของวันนี้จะถูกลบทั้งหมด"
        confirmText="ล้างคิว"
        cancelText="ยกเลิก"
        onConfirm={confirmReset}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}
