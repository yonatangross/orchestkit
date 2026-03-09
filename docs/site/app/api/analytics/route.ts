import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST() {
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
