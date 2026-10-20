import { listTasks, mutateTasks } from '@/lib/task-api';
export const dynamic = 'force-dynamic';
export const GET = listTasks;
export async function POST(request: Request) { return mutateTasks(request, 'create'); }
