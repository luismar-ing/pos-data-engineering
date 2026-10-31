// Expo solo incrusta EXPO_PUBLIC_* con acceso por punto (sin desestructurar). Se define en .env.local.
export const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;
