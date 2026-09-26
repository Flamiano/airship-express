import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../supabase/client';
import Loader from '@/app/components/Loader';
import { validateHRRole } from '../utils/roleValidation';

export function withHRProtection<P extends object>(
    WrappedComponent: React.ComponentType<P>
) {
    return function ProtectedHRComponent(props: P) {
        const [isLoading, setIsLoading] = useState(true);
        const [isAuthorized, setIsAuthorized] = useState(false);
        const router = useRouter();
        const pathname = usePathname();
        const supabase = createClient();

        useEffect(() => {
            checkAccess();
        }, []);

        const checkAccess = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    router.push('/hrAuth');
                    return;
                }

                const { data: userRole, error } = await supabase
                    .from('hr_admin')
                    .select('role, full_name, email, employee_id')
                    .eq('id', session.user.id)
                    .single();

                if (error || !userRole) {
                    console.error('Error fetching user role:', error);
                    router.push('/hrAuth');
                    return;
                }

                // Validate role for this path
                const validation = await validateHRRole(userRole.role, pathname);

                if (!validation.isValid) {
                    console.warn(
                        `User with role "${userRole.role}" tried to access "${pathname}"`
                    );
                    router.push(validation.redirectTo || '/hrAuth');
                    return;
                }

                setIsAuthorized(true);
            } catch (error) {
                console.error('Error checking HR access:', error);
                router.push('/hrAuth');
            } finally {
                setIsLoading(false);
            }
        };

        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <Loader />
                </div>
            );
        }

        if (!isAuthorized) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
}