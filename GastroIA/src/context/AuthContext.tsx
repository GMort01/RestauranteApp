import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, resetPassword as resetPasswordApi } from '../services/apiService';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ResetPasswordInput {
  email: string;
  newPassword: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  logout: () => Promise<void>;
}

const USERS_STORAGE_KEY = '@gastroia/auth/users';
const SESSION_STORAGE_KEY = '@gastroia/auth/session';

export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        // Rehidrata sesion local para mantener login entre aperturas.
        const sessionRaw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!sessionRaw) return;

        const parsed = JSON.parse(sessionRaw) as AuthUser;
        if (parsed?.id && parsed?.email) {
          setCurrentUser(parsed);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      }
    };

    hydrateSession();
  }, []);

  const login = async ({ email, password }: LoginInput) => {
    const safeEmail = normalizeEmail(email);
    const safePassword = password.trim();

    if (!safeEmail || !safePassword) {
      throw new Error('Completa correo y contraseña.');
    }

    if (!isValidEmail(safeEmail)) {
      throw new Error('Ingresa un correo válido, por ejemplo: nombre@correo.com.');
    }

    // Autenticacion contra backend; solo se persiste perfil publico en el dispositivo.
    const response = await loginUser({ email: safeEmail, password: safePassword });
    const publicUser = response.user;
    setCurrentUser(publicUser);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publicUser));
  };

  const register = async ({ name, email, password }: RegisterInput) => {
    const safeName = name.trim();
    const safeEmail = normalizeEmail(email);
    const safePassword = password.trim();

    if (!safeName || !safeEmail || !safePassword) {
      throw new Error('Completa nombre, correo y contraseña.');
    }

    if (!isValidEmail(safeEmail)) {
      throw new Error('Ingresa un correo válido, por ejemplo: nombre@correo.com.');
    }

    if (safePassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const response = await registerUser({
      name: safeName,
      email: safeEmail,
      password: safePassword,
    });

    const publicUser = response.user;
    setCurrentUser(publicUser);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publicUser));
  };

  const resetPassword = async ({ email, newPassword }: ResetPasswordInput) => {
    const safeEmail = normalizeEmail(email);
    const safePassword = newPassword.trim();

    if (!safeEmail || !safePassword) {
      throw new Error('Completa correo y nueva contraseña.');
    }

    if (!isValidEmail(safeEmail)) {
      throw new Error('Ingresa un correo válido, por ejemplo: nombre@correo.com.');
    }

    if (safePassword.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    // El backend valida existencia de cuenta y reemplaza hash/salt de contraseña.
    await resetPasswordApi({
      email: safeEmail,
      new_password: safePassword,
    });
  };

  const logout = async () => {
    // Cierra sesion local de forma explicita.
    setCurrentUser(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        register,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
