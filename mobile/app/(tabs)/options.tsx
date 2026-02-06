import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import OptionsScreen from '../../components/screens/OptionsScreen';
import OptionsWeb from './options.web';

export default function OptionsTabRef() {
    const router = useRouter();

    // When back is pressed from Options tab, go to Settings tab
    const handleBack = () => {
        router.push('/(tabs)/settings');
    };

    // Use web version on web, native OptionsScreen otherwise
    if (Platform.OS === 'web') {
        return <OptionsWeb />;
    }

    return <OptionsScreen customBackAction={handleBack} />;
}
