import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET: ดึงรายชื่ออาจารย์ทั้งหมดพร้อมตาราง + จำนวนคิว
export async function GET() {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        schedules: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { queues: { where: { status: { in: ['WAITING', 'CALLING'] } } } } },
      },
      orderBy: { id: 'asc' },
    })

    const safeTeachers = teachers.map(({ password, ...t }) => t)
    return NextResponse.json({ teachers: safeTeachers })
  } catch (error) {
    console.error('GET /api/teachers error:', error)
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 })
  }
}
