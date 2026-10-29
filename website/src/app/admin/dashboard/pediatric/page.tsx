import { redirect } from 'next/navigation';
import { requirePediatricAdmin } from '@/lib/pediatric/requireAdmin';
import PediatricWorkspace from './workspace';
export const dynamic = 'force-dynamic';
export default async function PediatricPage() {
  if (!await requirePediatricAdmin()) redirect('/login?callbackUrl=%2Fadmin%2Fdashboard%2Fpediatric');
  return <PediatricWorkspace />;
}
