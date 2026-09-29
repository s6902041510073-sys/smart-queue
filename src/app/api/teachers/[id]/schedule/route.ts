import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// POST: อัปเดตตารางเวลาอาจารย์ (replace all)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teacherId = parseInt(params.id)
    const body = await request.json()
    const { schedules } = body

    // ลบตารางเก่าทั้งหมด
    await prisma.schedule.deleteMany({ where: { teacherId } })

    // สร้างตารางใหม่
    if (schedules && schedules.length > 0) {
      await prisma.schedule.createMany({
        data: schedules.map((s: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }) => ({
          teacherId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive ?? true,
        })),
      })
    }

    const updated = await prisma.schedule.findMany({
      where: { teacherId },
      orderBy: { dayOfWeek: 'asc' },
    })

    return NextResponse.json({ schedules: updated })
  } catch (error) {
    console.error('POST /api/teachers/[id]/schedule error:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}
