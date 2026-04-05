import Constants from "expo-constants";
import { Platform } from "react-native";
import {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from "@react-native-google-signin/google-signin";
import apiService from "../api/apiService";

let isConfigured = false;

export function configureGoogleSignIn() {
    if (isConfigured) {
        return;
    }

    const extra = Constants.expoConfig?.extra ?? {};

    GoogleSignin.configure({
        iosClientId: extra.googleIosClientId,
        webClientId: extra.googleWebClientId || extra.googleExpoClientId,
        profileImageSize: 120,
    });

    isConfigured = true;
}

export async function signInWithGoogle() {
    configureGoogleSignIn();

    if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
        });
    }

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
        return null;
    }

    const tokens = await GoogleSignin.getTokens();

    return {
        google_access_token: tokens.accessToken,
    };
}

export async function authenticateWithGoogle() {
    const googleCredentials = await signInWithGoogle();

    if (!googleCredentials) {
        return null;
    }

    return apiService.googleLogin(googleCredentials);
}

export function getGoogleSignInErrorMessage(error) {
    if (isErrorWithCode(error)) {
        switch (error.code) {
            case statusCodes.SIGN_IN_CANCELLED:
                return null;
            case statusCodes.IN_PROGRESS:
                return "Google sign-in is already in progress.";
            case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                return "Google Play Services is unavailable on this device.";
            default:
                break;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Google sign-in failed. Please try again.";
}