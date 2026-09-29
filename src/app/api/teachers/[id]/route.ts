import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// GET: ดึงข้อมูลอาจารย์ท่านเดียว
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    })
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }
    const { password, ...safe } = teacher
    return NextResponse.json({ teacher: safe })
  } catch (error) {
    console.error('GET /api/teachers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch teacher' }, { status: 500 })
  }
}

// PATCH: อัปเดตข้อมูลอาจารย์
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { name, title, emoji, isActive } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (title !== undefined) data.title = title
    if (emoji !== undefined) data.emoji = emoji
    if (isActive !== undefined) data.isActive = isActive

    const teacher = await prisma.teacher.update({ where: { id }, data })
    const { password, ...safe } = teacher
    return NextResponse.json({ teacher: safe })
  } catch (error) {
    console.error('PATCH /api/teachers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update teacher' }, { status: 500 })
  }
}
