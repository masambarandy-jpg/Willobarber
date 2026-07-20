import React, { createContext, useContext, useState, useCallback } from 'react';

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
  lastName: 'Diallo',
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

  return (
    <CoiffeurProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </CoiffeurProfileContext.Provider>
  );
}

export function useCoiffeurProfile(): CoiffeurProfileContextType {
  return useContext(CoiffeurProfileContext);
}
