import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// GET: ดึงข้อมูลคิว (filter by teacherId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacherId')
    const teacherFilter = teacherId ? { teacherId: parseInt(teacherId) } : {}

    const queues = await prisma.queue.findMany({
      where: { ...teacherFilter, status: { in: ['WAITING', 'CALLING'] } },
      orderBy: { queueNumber: 'asc' },
      include: { teacher: { select: { name: true, emoji: true } } },
    })

    const currentCalling = await prisma.queue.findFirst({
      where: { ...teacherFilter, status: 'CALLING' },
      orderBy: { updatedAt: 'desc' },
      include: { teacher: { select: { name: true, emoji: true } } },
    })

    const lastQueue = await prisma.queue.findFirst({
      where: teacherFilter,
      orderBy: { queueNumber: 'desc' },
    })
    const nextQueueNumber = (lastQueue?.queueNumber ?? 0) + 1

    const waiting = await prisma.queue.count({ where: { ...teacherFilter, status: 'WAITING' } })
    const calling = await prisma.queue.count({ where: { ...teacherFilter, status: 'CALLING' } })
    const completed = await prisma.queue.count({ where: { ...teacherFilter, status: 'COMPLETED' } })
    const skipped = await prisma.queue.count({ where: { ...teacherFilter, status: 'SKIPPED' } })

    return NextResponse.json({
      queues,
      currentCalling,
      nextQueueNumber,
      stats: { waiting, calling, completed, skipped },
    })
  } catch (error) {
    console.error('GET /api/queue error:', error)
    return NextResponse.json({ error: 'Failed to fetch queues' }, { status: 500 })
  }
}

// POST: จองคิว (ต้องระบุ teacherId)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, studentName, teacherId } = body

    if (!studentId || studentId.trim() === '') {
      return NextResponse.json({ error: 'กรุณากรอกรหัสนักศึกษา' }, { status: 400 })
    }
    if (!teacherId) {
      return NextResponse.json({ error: 'กรุณาเลือกอาจารย์' }, { status: 400 })
    }

    // ตรวจสอบว่ามีคิวซ้ำกับอาจารย์ท่านนี้หรือไม่
    const existing = await prisma.queue.findFirst({
      where: {
        studentId: studentId.trim(),
        teacherId,
        status: { in: ['WAITING', 'CALLING'] },
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'คุณมีคิวกับอาจารย์ท่านนี้อยู่แล้ว' }, { status: 400 })
    }

    // หาเลขคิวถัดไปสำหรับอาจารย์ท่านนี้
    const lastQueue = await prisma.queue.findFirst({
      where: { teacherId },
      orderBy: { queueNumber: 'desc' },
    })
    const nextNumber = (lastQueue?.queueNumber ?? 0) + 1

    const queue = await prisma.queue.create({
      data: {
        queueNumber: nextNumber,
        studentId: studentId.trim(),
        studentName: studentName?.trim() || '',
        teacherId,
      },
      include: { teacher: { select: { name: true, emoji: true } } },
    })

    const position = await prisma.queue.count({
      where: { teacherId, status: 'WAITING', queueNumber: { lt: queue.queueNumber } },
    })

    return NextResponse.json({ queue, position })
  } catch (error) {
    console.error('POST /api/queue error:', error)
    return NextResponse.json({ error: 'Failed to book queue' }, { status: 500 })
  }
}
