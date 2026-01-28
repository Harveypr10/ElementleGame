import { createContext, useContext, ReactNode } from 'react';

interface AppReadinessContextType {
    isAppReady: boolean;
}

const AppReadinessContext = createContext<AppReadinessContextType>({ isAppReady: false });

export function useAppReadiness() {
    return useContext(AppReadinessContext);
}

export function AppReadinessProvider({
    children,
    isReady
}: {
    children: ReactNode;
    isReady: boolean;
}) {
    return (
        <AppReadinessContext.Provider value={{ isAppReady: isReady }}>
            {children}
        </AppReadinessContext.Provider>
    );
}
