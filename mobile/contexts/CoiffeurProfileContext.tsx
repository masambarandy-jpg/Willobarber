import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoiffeurProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
};

type CoiffeurProfileContextType = {
  profile: CoiffeurProfile;
  updateProfile: (updates: Partial<CoiffeurProfile>) => void;
};

const DEFAULT_PROFILE: CoiffeurProfile = {
  firstName: 'Willo',
  lastName: 'Barber',
  email: 'willo@willobarber.fr',
  phone: '06 45 78 29 70',
  role: 'Gérant',
};

const CoiffeurProfileContext = createContext<CoiffeurProfileContextType>({
  profile: DEFAULT_PROFILE,
  updateProfile: () => {},
});

export function CoiffeurProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CoiffeurProfile>(DEFAULT_PROFILE);

  const updateProfile = useCallback((updates: Partial<CoiffeurProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('coiffeur_token');
        if (!token) return;

        const response = await fetch(
          'https://willobarber-production-6951.up.railway.app/api/auth/me/',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) return;

        const data = await response.json();
        updateProfile({
          firstName: data.first_name,
          lastName: data.last_name,
          role: data.role === 'barber' ? 'Gérant' : data.role,
        });
      } catch (e) {
        // Garder les valeurs par défaut en cas d'erreur
      }
    })();
  }, [updateProfile]);

  return (
    <CoiffeurProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </CoiffeurProfileContext.Provider>
  );
}

export function useCoiffeurProfile(): CoiffeurProfileContextType {
  return useContext(CoiffeurProfileContext);
}
