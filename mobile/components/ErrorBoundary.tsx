import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styled } from 'nativewind';
import { AlertTriangle } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console (in production, send to error tracking service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // TODO: Send to error tracking service (Sentry, Bugsnag, etc.)
        // Example: Sentry.captureException(error, { extra: errorInfo });

        this.setState({
            error,
            errorInfo,
        });
    }

    handleRetry = () => {
        // Reset error state to retry rendering
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI from props
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <StyledView className="flex-1 bg-white dark:bg-slate-900 items-center justify-center px-6">
                    <StyledView className="items-center mb-6">
                        <AlertTriangle size={64} color="#ef4444" />
                        <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white mt-4 text-center">
                            Oops! Something went wrong
                        </StyledText>
                        <StyledText className="text-base font-n-medium text-slate-600 dark:text-slate-400 mt-2 text-center">
                            We've encountered an unexpected error. Don't worry, your data is safe.
                        </StyledText>
                    </StyledView>

                    {/* Error Details (only in development) */}
                    {__DEV__ && this.state.error && (
                        <StyledScrollView className="w-full max-h-48 bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-6">
                            <StyledText className="text-xs font-mono text-red-600 dark:text-red-400">
                                {this.state.error.toString()}
                            </StyledText>
                            {this.state.errorInfo && (
                                <StyledText className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-2">
                                    {this.state.errorInfo.componentStack}
                                </StyledText>
                            )}
                        </StyledScrollView>
                    )}

                    <StyledView className="w-full gap-3">
                        <StyledTouchableOpacity
                            onPress={this.handleRetry}
                            className="bg-blue-500 py-4 rounded-xl items-center active:bg-blue-600"
                        >
                            <StyledText className="text-white font-n-bold text-lg">
                                Try Again
                            </StyledText>
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity
                            onPress={() => {
                                // In a real app, this would navigate to home or restart
                                // For now, just retry
                                this.handleRetry();
                            }}
                            className="bg-slate-200 dark:bg-slate-700 py-4 rounded-xl items-center active:bg-slate-300 dark:active:bg-slate-600"
                        >
                            <StyledText className="text-slate-900 dark:text-white font-n-bold text-lg">
                                Return to Home
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>

                    {!__DEV__ && (
                        <StyledText className="text-sm font-n-medium text-slate-500 dark:text-slate-500 mt-6 text-center">
                            If this problem persists, please contact support.
                        </StyledText>
                    )}
                </StyledView>
            );
        }

        return this.props.children;
    }
}
