import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// POST: รีเซ็ตคิว (ตาม teacherId หรือทั้งหมด)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { teacherId } = body as { teacherId?: number }

    const where = teacherId ? { teacherId } : {}
    const result = await prisma.queue.deleteMany({ where })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('POST /api/queue/reset error:', error)
    return NextResponse.json({ error: 'Failed to reset queues' }, { status: 500 })
  }
}
