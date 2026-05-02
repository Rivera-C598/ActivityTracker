import { CheckCircle, AlertTriangle, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { SubmissionStatus } from '../types';

export const StatusIcon = ({ status, className }: { status: SubmissionStatus; className?: string }) => {
  switch (status) {
    case 'pass':
      return <CheckCircle className={`text-emerald-500 ${className}`} />;
    case 'resubmit':
      return <AlertTriangle className={`text-amber-500 ${className}`} />;
    case 'oral':
      return <AlertCircle className={`text-purple-500 ${className}`} />;
    case 'missing':
      return <XCircle className={`text-rose-500 ${className}`} />;
    case 'pending':
    default:
      return <Clock className={`text-slate-400 ${className}`} />;
  }
};
