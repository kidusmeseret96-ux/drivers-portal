import React from 'react';
import {AlertTriangle, CheckCircle2, Clock, XCircle} from 'lucide-react';

export type SemanticTone = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusTextProps {
  label: string;
  tone?: SemanticTone;
  className?: string;
}

export const StatusText: React.FC<StatusTextProps> = ({label, tone = 'neutral', className = ''}) => {
  const toneStyles: Record<SemanticTone, string> = {
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  };

  const renderIcon = () => {
    switch (tone) {
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'danger':
        return <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      default:
        return <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneStyles[tone]} ${className}`}>
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
};

export function mapStatusToTone(status: string): SemanticTone {
  switch (status) {
    case 'Active':
    case 'Roadworthy':
    case 'Paid':
    case 'Passed':
    case 'Verified':
    case 'Resolved':
    case 'Closed':
    case 'valid':
      return 'success';
    case 'Pending':
    case 'Maintenance':
    case 'Partial':
    case 'Conditional':
    case 'Needs Review':
    case 'Paper Pending':
    case 'Under Review':
    case 'Medium':
    case 'expiring':
      return 'warning';
    case 'Suspended':
    case 'Impounded':
    case 'Overdue':
    case 'Failed':
    case 'High':
    case 'Critical':
    case 'Open':
    case 'expired':
      return 'danger';
    default:
      return 'neutral';
  }
}
