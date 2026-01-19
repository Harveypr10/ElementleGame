import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/OnboardingScreen';

export default function OnboardingPage() {
    const router = useRouter();
    const [eventTitle, setEventTitle] = useState('Loading...');
    const [puzzleDate, setPuzzleDate] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTodaysPuzzle();
    }, []);

    const fetchTodaysPuzzle = async () => {
        try {
            // TODO: Fetch today's REGION puzzle from Supabase
            // For now, use mock data
            const today = new Date().toISOString().split('T')[0];

            // Mock event title
            setEventTitle('The Battle of Hastings');
            setPuzzleDate(today);
        } catch (error) {
            console.error('Error fetching puzzle:', error);
            setEventTitle('Today\'s Historical Event');
            setPuzzleDate(new Date().toISOString().split('T')[0]);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = () => {
        // Play as guest - navigate to today's REGION game
        router.push('/game/REGION/today');
    };

    const handleLogin = () => {
        router.push('/(auth)/login');
    };

    const handleSubscribe = () => {
        // Subscribe feature not yet implemented
    };

    if (loading) {
        return null; // Or a loading spinner
    }

    return (
        <OnboardingScreen
            eventTitle={eventTitle}
            puzzleDateCanonical={puzzleDate}
            onPlay={handlePlay}
            onLogin={handleLogin}
            onSubscribe={handleSubscribe}
        />
    );
}
