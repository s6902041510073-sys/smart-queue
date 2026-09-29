import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST: Seed ข้อมูลตัวอย่างอาจารย์ + ตารางสอน
export async function POST() {
  try {
    // ลบข้อมูลเก่า
    await prisma.queue.deleteMany()
    await prisma.schedule.deleteMany()
    await prisma.teacher.deleteMany()

    // สร้างอาจารย์ + ตารางสอน
    await prisma.teacher.create({
      data: {
        name: 'อ.สมชาย ปัญญาดี',
        title: 'วิชาโปรแกรมมิ่ง',
        emoji: '👨‍🏫',
        password: '1111',
        schedules: {
          create: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 2, startTime: '13:00', endTime: '16:00' },
            { dayOfWeek: 3, startTime: '13:00', endTime: '16:00' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '12:00' },
          ],
        },
      },
    })

    await prisma.teacher.create({
      data: {
        name: 'อ.วิภาวี เก่งมาก',
        title: 'วิชาฐานข้อมูล',
        emoji: '👩‍🏫',
        password: '2222',
        schedules: {
          create: [
            { dayOfWeek: 1, startTime: '13:00', endTime: '16:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 4, startTime: '13:00', endTime: '15:00' },
          ],
        },
      },
    })

    await prisma.teacher.create({
      data: {
        name: 'อ.วิชัย รักเรียน',
        title: 'วิชาเครือข่ายคอมพิวเตอร์',
        emoji: '👨‍💻',
        password: '3333',
        schedules: {
          create: [
            { dayOfWeek: 2, startTime: '13:00', endTime: '16:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 5, startTime: '13:00', endTime: '16:00' },
          ],
        },
      },
    })

    const teachers = await prisma.teacher.findMany({ include: { schedules: true } })

    return NextResponse.json({
      success: true,
      message: `สร้างอาจารย์ ${teachers.length} ท่านสำเร็จ`,
      teachers: teachers.map(({ password, ...t }) => t),
    })
  } catch (error) {
    console.error('POST /api/seed error:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}
