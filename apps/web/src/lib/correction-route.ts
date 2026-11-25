import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getAuthOptions } from './auth'
import { correctionAccess } from './correction-nutrition'
export async function requireCorrectionSession(moderator=false){const session=await getServerSession(await getAuthOptions());if(!session?.user.id||session.user.isBanned)redirect('/login');if(!correctionAccess(session.user,moderator))redirect('/')}
