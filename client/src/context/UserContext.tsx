import React, { createContext, useContext, useState } from 'react';

interface User {
  fullName: string;
  email: string;
  plan: string;
  walletAddress?: string;
}

interface UserContextProps {
  user: User;
  updateUser: (updatedUser: Partial<User>) => void;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize walletAddress from localStorage or use default test address
  const getInitialWalletAddress = () => {
    if (typeof window === 'undefined') return '';
    try {
      // Try to get from localStorage
      const stored = localStorage.getItem('neofin_wallet');
      if (stored) {
        console.log('Loaded wallet address from localStorage:', stored);
        return stored;
      }
      
      // Try to get from auth data
      const authStored = localStorage.getItem('neofin_auth');
      if (authStored) {
        const auth = JSON.parse(authStored);
        if (auth.walletAddress) {
          console.log('Loaded wallet address from auth:', auth.walletAddress);
          return auth.walletAddress;
        }
      }
    } catch (error) {
      console.error('Error reading wallet address from localStorage:', error);
    }
    
    // Use a test wallet address if none found
    console.warn('No wallet address found. Using test address. Connect a wallet to use your own.');
    return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Valid checksummed test address
  };

  const [user, setUser] = useState<User>({
    fullName: '',
    email: '',
    plan: 'Free Plan',
    walletAddress: getInitialWalletAddress(),
  });

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
    
    // Persist wallet address to localStorage if updated
    if (updatedUser.walletAddress) {
      try {
        localStorage.setItem('neofin_wallet', updatedUser.walletAddress);
      } catch (error) {
        console.error('Error saving wallet address to localStorage:', error);
      }
    }
  };

  return (
    <UserContext.Provider value={{ user, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
