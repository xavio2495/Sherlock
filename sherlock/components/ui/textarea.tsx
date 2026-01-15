import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-muted-foreground border-brutalist flex field-sizing-content min-h-16 w-full bg-background px-3 py-2 text-base transition-shadow outline-none focus-visible:shadow-brutalist-sm disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:border-warning',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
