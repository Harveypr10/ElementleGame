import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateGuestDataToUser } from './guestMigration';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    isAuthenticated: boolean;
    loading: boolean;
    signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signInAnonymously: () => Promise<void>;
    signOut: () => Promise<void>;
    hasCompletedFirstLogin: () => boolean;
    markFirstLoginCompleted: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isGuest: false,
    isAuthenticated: false,
    loading: true,
    signInWithEmail: async () => ({ error: null }),
    signUpWithEmail: async () => ({ error: null }),
    signInAnonymously: async () => { },
    signOut: async () => { },
    hasCompletedFirstLogin: () => false,
    markFirstLoginCompleted: async () => { },
});

// Helper function to sync OAuth provider linkage to database
async function syncOAuthProfile(user: User) {
    try {
        const googleIdentity = user.identities?.find(i => i.provider === 'google');
        const appleIdentity = user.identities?.find(i => i.provider === 'apple');

        const updates: any = {};
        if (googleIdentity) {
            updates.google_linked = true;
        }
        if (appleIdentity) {
            updates.apple_linked = true;
        }

        if (Object.keys(updates).length > 0) {
            console.log('[Auth] Syncing OAuth profile:', updates);
            const { error } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) {
                console.error('[Auth] Error syncing OAuth profile:', error);
            } else {
                console.log('[Auth] OAuth profile synced successfully');
            }
        }
    } catch (error) {
        console.error('[Auth] Error in syncOAuthProfile:', error);
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isGuest, setIsGuest] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check active sessions
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    setSession(session);
                    setUser(session.user);
                    setIsGuest(false); // Valid session implies not guest
                } else {
                    // Check if previously in guest mode
                    const storedGuest = await AsyncStorage.getItem('is_guest');
                    if (storedGuest === 'true') {
                        setIsGuest(true);
                    }
                }
            } catch (e) {
                console.error("Auth initialization error:", e);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for changes on auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] State change:', event, session?.user?.id);
            setSession(session);
            setUser(session?.user ?? null);

            if (session) {
                setIsGuest(false);
                await AsyncStorage.removeItem('is_guest');

                // Sync OAuth provider linkage to database
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    await syncOAuthProfile(session.user);
                }
            }
            // If session is null, we don't automatically set guest to false/true 
            // because signOut logic handles that explicitly.
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                return { error };
            }

            // Mark password_created in user_profiles since user created account with password
            if (data.session && data.user) {
                try {
                    console.log('[Auth] Marking password_created=true for user:', data.user.id);
                    const { error: updateError } = await supabase
                        .from('user_profiles')
                        .update({
                            password_created: true,
                            signup_method: 'password'
                        })
                        .eq('id', data.user.id);

                    if (updateError) {
                        console.error('[Auth] Error setting password_created:', updateError);
                    } else {
                        console.log('[Auth] Successfully marked password_created=true');
                    }
                } catch (err) {
                    console.error('[Auth] Error updating password_created:', err);
                }

                // Migrate guest data if converting from guest mode
                try {
                    console.log('[Auth] Starting guest data migration for user:', data.user.id);
                    const migrationResult = await migrateGuestDataToUser(data.user.id);
                    if (migrationResult.success) {
                        console.log(`[Auth] Guest migration successful: ${migrationResult.migratedGames} games migrated`);
                    } else {
                        console.error('[Auth] Guest migration failed:', migrationResult.error);
                    }
                } catch (migrationError) {
                    console.error('[Auth] Error during guest migration:', migrationError);
                }
            }

            return { data, error: null };
        } catch (error: any) {
            return { error };
        }
    };

    const signInAnonymously = async () => {
        setIsGuest(true);
        await AsyncStorage.setItem('is_guest', 'true');
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setIsGuest(false);
        await AsyncStorage.removeItem('is_guest');
    };

    const hasCompletedFirstLogin = () => {
        if (isGuest) return true; // Guests don't need first login setup
        return !!user?.user_metadata?.first_login_completed;
    };

    const markFirstLoginCompleted = async () => {
        if (isGuest) return; // No-op for guests
        if (!user) return;
        const { data, error } = await supabase.auth.updateUser({
            data: { first_login_completed: true }
        });

        if (error) {
            console.error('Error updating first login metadata:', error);
        } else {
            setUser(data.user);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                isGuest,
                isAuthenticated: !!user && !isGuest,
                loading,
                signInWithEmail,
                signUpWithEmail,
                signInAnonymously,
                signOut,
                hasCompletedFirstLogin,
                markFirstLoginCompleted
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
