import React from 'react';
import { cn } from '../../utils/helpers/classNames';
import { Card, CardBody } from './Card';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    subtitle?: string;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    trend,
    subtitle,
    className,
}) => {
    return (
        <Card variant="elevated" className={cn('relative overflow-hidden', className)}>
            <CardBody>
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
                        {trend && (
                            <div className="flex items-center mt-1">
                                <span
                                    className={cn(
                                        'inline-flex items-center text-xs font-medium',
                                        trend.isPositive ? 'text-green-600' : 'text-red-600'
                                    )}
                                >
                                    {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                                </span>
                                {subtitle && (
                                    <span className="ml-2 text-xs text-gray-500">{subtitle}</span>
                                )}
                            </div>
                        )}
                        {subtitle && !trend && (
                            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
                        )}
                    </div>
                    {icon && (
                        <div className="flex-shrink-0 p-3 bg-blue-50 rounded-lg">
                            <div className="h-6 w-6 text-blue-600">{icon}</div>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
};