import { llmsResponse } from '@/lib/data/llms'

// Reads CMS data per request (no DB at build time).
export const dynamic = 'force-dynamic'

export const GET = () => llmsResponse(false)
