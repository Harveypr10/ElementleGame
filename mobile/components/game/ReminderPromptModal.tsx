import React from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { Bell, X } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const SCREEN_WIDTH = Dimensions.get('window').width;

const WelcomeHamster = require('../../assets/ui/webp_assets/Signup-Hamster-Transparent.webp');

interface ReminderPromptModalProps {
    visible: boolean;
    onClose: (action: 'yes' | 'not_now' | 'never') => void;
}

export function ReminderPromptModal({ visible, onClose }: ReminderPromptModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => onClose('not_now')}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <StyledView
                    className="rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-6"
                    style={{ backgroundColor: '#f8fafc' }}
                >
                    {/* Close Button */}
                    <StyledTouchableOpacity
                        onPress={() => onClose('not_now')}
                        className="absolute right-4 top-4 p-2 bg-slate-200 rounded-full z-10"
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <X size={18} color="#64748b" />
                    </StyledTouchableOpacity>

                    {/* Hamster Image */}
                    <StyledView className="items-center mb-4 mt-2">
                        <Image
                            source={WelcomeHamster}
                            style={{ width: 100, height: 100 }}
                            contentFit="contain"
                        />
                    </StyledView>

                    {/* Bell Icon + Title */}
                    <StyledView className="flex-row items-center justify-center gap-2 mb-3">
                        <Bell size={22} color="#7DAAE8" />
                        <StyledText className="text-xl font-n-bold text-slate-900 text-center">
                            Daily Reminder
                        </StyledText>
                    </StyledView>

                    {/* Description */}
                    <StyledText className="text-center text-slate-600 font-n-medium mb-6 leading-6">
                        Want a reminder so you don't lose your streak?
                    </StyledText>

                    {/* Action Buttons (Stacked) */}
                    <StyledView className="gap-3">
                        {/* Yes - Primary blue */}
                        <StyledTouchableOpacity
                            onPress={() => onClose('yes')}
                            className="py-3.5 rounded-2xl active:opacity-80"
                            style={{ backgroundColor: '#7DAAE8' }}
                        >
                            <StyledText className="text-white font-n-bold text-center text-lg">
                                Yes, remind me
                            </StyledText>
                        </StyledTouchableOpacity>

                        {/* Not now - Gray */}
                        <StyledTouchableOpacity
                            onPress={() => onClose('not_now')}
                            className="bg-slate-200 active:bg-slate-300 py-3.5 rounded-2xl"
                        >
                            <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                                Not now
                            </StyledText>
                        </StyledTouchableOpacity>

                        {/* Don't ask again - Subtle */}
                        <StyledTouchableOpacity
                            onPress={() => onClose('never')}
                            className="py-2"
                        >
                            <StyledText className="text-slate-400 font-n-medium text-center text-sm">
                                Don't ask again
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </View>
        </Modal>
    );
}
