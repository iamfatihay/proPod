import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo,
        });

        // Log error to console in development
        if (__DEV__) {
            console.error("ErrorBoundary caught an error:", error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View className="flex-1 bg-background items-center justify-center px-6">
                    <MaterialCommunityIcons
                        name="alert-circle"
                        size={64}
                        color="#EF4444"
                        className="mb-4"
                    />
                    <Text className="text-xl font-bold text-text-primary text-center mb-2">
                        Oops! Something went wrong
                    </Text>
                    <Text className="text-text-secondary text-center mb-6">
                        We encountered an unexpected error. Please try again or
                        contact support if the problem persists.
                    </Text>

                    <TouchableOpacity
                        onPress={this.handleRetry}
                        className="bg-primary px-6 py-3 rounded-lg"
                    >
                        <Text className="text-white font-semibold">
                            Try Again
                        </Text>
                    </TouchableOpacity>

                    {__DEV__ && this.state.error && (
                        <View className="mt-6 p-4 bg-panel rounded-lg w-full">
                            <Text className="text-error text-sm font-mono mb-2">
                                Error Details (Development):
                            </Text>
                            <Text className="text-text-secondary text-xs font-mono">
                                {this.state.error.toString()}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
