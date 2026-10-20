import { mutateTasks } from '@/lib/task-api';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return mutateTasks(request, 'update'); }
