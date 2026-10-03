import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google Provider with Google Drive Readonly Scope
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
// Set custom parameters to ensure prompt if needed
provider.setCustomParameters({
  prompt: 'select_account',
});

const TOKEN_STORAGE_KEY = 'scout_google_drive_token';
const USER_EMAIL_STORAGE_KEY = 'scout_google_user_email';

let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
let isSigningIn = false;

// Listeners for token/auth state changes
const authListeners: Array<(connected: boolean, email?: string | null) => void> = [];

export const onGoogleDriveAuthChange = (listener: (connected: boolean, email?: string | null) => void) => {
  authListeners.push(listener);
  // Emit current state immediately
  listener(!!cachedAccessToken, typeof window !== 'undefined' ? sessionStorage.getItem(USER_EMAIL_STORAGE_KEY) : null);
  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
};

const notifyListeners = () => {
  const connected = !!cachedAccessToken;
  const email = typeof window !== 'undefined' ? sessionStorage.getItem(USER_EMAIL_STORAGE_KEY) : null;
  authListeners.forEach((fn) => fn(connected, email));
};

// Initialize Auth listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        notifyListeners();
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }
      notifyListeners();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup and obtain access token with Google Drive scope.
 */
export const signInWithGoogleDrive = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('لم نتمكن من الحصول على تصريح الوصول من Google Drive');
    }

    cachedAccessToken = token;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (result.user.email) {
        sessionStorage.setItem(USER_EMAIL_STORAGE_KEY, result.user.email);
      }
    }
    notifyListeners();
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached Google Drive access token.
 */
export const getGoogleAccessToken = (): string | null => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return cachedAccessToken;
};

/**
 * Get current connected Google account email.
 */
export const getGoogleAccountEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(USER_EMAIL_STORAGE_KEY) || auth.currentUser?.email || null;
  }
  return null;
};

/**
 * Sign out from Google.
 */
export const signOutGoogle = async (): Promise<void> => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  }
  notifyListeners();
  await signOut(auth);
};
