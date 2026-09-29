import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// POST: ตรวจสอบรหัสผ่านอาจารย์ (per-teacher auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, password } = body

    if (!teacherId || !password) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: Number(teacherId) },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    })

    if (!teacher) {
      return NextResponse.json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    const validPassword = password === process.env.TEACHER_PASSWORD || teacher.password === password

    if (!validPassword) {
      return NextResponse.json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    const { password: _, ...safe } = teacher
    return NextResponse.json({ success: true, teacher: safe })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
