import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { name, title, emoji, password } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (title !== undefined) updateData.title = title
    if (emoji !== undefined) updateData.emoji = emoji
    if (password !== undefined && password !== '') updateData.password = password

    const updatedTeacher = await prisma.teacher.update({
      where: { id },
      data: updateData,
      include: {
        schedules: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
      }
    })

    const safeTeacher = { ...updatedTeacher }
    // @ts-ignore
    delete safeTeacher.password

    return NextResponse.json({ success: true, teacher: safeTeacher })
  } catch (error) {
    console.error('PATCH /api/teachers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update teacher' }, { status: 500 })
  }
}
