import React from 'react';
import { cn } from '../../utils/helpers/classNames';

export interface DatePickerProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
    ({ className, ...props }, ref) => {
        return (
            <input
                type="date"
                ref={ref}
                className={cn(
                    "flex h-10 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
        );
    }
);
DatePicker.displayName = 'DatePicker';

export { DatePicker };