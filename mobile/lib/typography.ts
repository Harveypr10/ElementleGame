
import { Text, TextInput, StyleSheet } from 'react-native';

const defaultFontFamily = {
    fontFamily: 'Nunito_400Regular',
};



// Alternative: Patching defaultProps (simpler but deprecated)
// We will use the defaultProps approach for now as it works reliably in RN/Expo 50+
// even if React warns. It's the standard way to fix this quickly.

interface TextWithDefaultProps extends Text {
    defaultProps?: { style?: any };
}

interface TextInputWithDefaultProps extends TextInput {
    defaultProps?: { style?: any };
}

(Text as unknown as TextWithDefaultProps).defaultProps = (Text as unknown as TextWithDefaultProps).defaultProps || {};
(Text as unknown as TextWithDefaultProps).defaultProps!.style = [{ fontFamily: 'Nunito_400Regular' }];

(TextInput as unknown as TextInputWithDefaultProps).defaultProps = (TextInput as unknown as TextInputWithDefaultProps).defaultProps || {};
(TextInput as unknown as TextInputWithDefaultProps).defaultProps!.style = [{ fontFamily: 'Nunito_400Regular' }];
