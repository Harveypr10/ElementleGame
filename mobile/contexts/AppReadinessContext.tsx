import { createContext, useContext, ReactNode } from 'react';

interface AppReadinessContextType {
    isAppReady: boolean;
    userPuzzleReady: boolean;
}

const AppReadinessContext = createContext<AppReadinessContextType>({ isAppReady: false, userPuzzleReady: false });

export function useAppReadiness() {
    return useContext(AppReadinessContext);
}

export function AppReadinessProvider({
    children,
    isReady,
    userPuzzleReady = false
}: {
    children: ReactNode;
    isReady: boolean;
    userPuzzleReady?: boolean;
}) {
    return (
        <AppReadinessContext.Provider value={{ isAppReady: isReady, userPuzzleReady }}>
            {children}
        </AppReadinessContext.Provider>
    );
}
