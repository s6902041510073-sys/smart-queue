import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// PATCH: อัปเดตสถานะคิว (เรียก / เสร็จสิ้น / ข้าม)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { action } = body

    if (!['call', 'complete', 'skip'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const statusMap: Record<string, string> = {
      call: 'CALLING',
      complete: 'COMPLETED',
      skip: 'SKIPPED',
    }

    const queue = await prisma.queue.update({
      where: { id },
      data: { status: statusMap[action] },
    })

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('PATCH /api/queue/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update queue' }, { status: 500 })
  }
}

// DELETE: ยกเลิกคิว (โดยนักศึกษา)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    await prisma.queue.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/queue/[id] error:', error)
    return NextResponse.json({ error: 'Failed to cancel queue' }, { status: 500 })
  }
}
