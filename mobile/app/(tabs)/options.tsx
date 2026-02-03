import { useRouter } from 'expo-router';
import OptionsScreen from '../../components/screens/OptionsScreen';

export default function OptionsTabRef() {
    const router = useRouter();

    // When back is pressed from Options tab, go to Settings tab
    const handleBack = () => {
        router.push('/(tabs)/settings');
    };

    return <OptionsScreen customBackAction={handleBack} />;
}
