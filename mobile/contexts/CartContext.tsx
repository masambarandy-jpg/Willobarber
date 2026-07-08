import React, { createContext, useContext, useState, useCallback } from 'react';
import { API_BASE_URL } from '@/constants';
import { TokenStorage } from '@/services/api';
import axios from 'axios';

export type CartItem = {
  id: string;
  product_id: number;
  cat: string;
  nom: string;
  prix: number;
  qte: number;
  contenance: string;
  photo: string;
};

export type OrderData = {
  id: number;
  numero: string;
  status: string;
  total: string;
  created_at: string;
  items: Array<{
    id: number;
    product: {
      id: number;
      nom: string;
      categorie: string;
      prix: string;
      contenance: string;
      photo_url: string;
    };
    quantite: number;
    prix_unitaire: string;
  }>;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'qte'>) => void;
  removeItem: (id: string) => void;
  updateQte: (id: string, qte: number) => void;
  clearCart: () => void;
  total: number;
  nbArticles: number;
  isLoading: boolean;
  checkout: () => Promise<OrderData>;
  lastOrder: OrderData | null;
  clearLastOrder: () => void;
};

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQte: () => {},
  clearCart: () => {},
  total: 0,
  nbArticles: 0,
  isLoading: false,
  checkout: async () => { throw new Error('CartProvider manquant'); },
  lastOrder: null,
  clearLastOrder: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderData | null>(null);

  const addItem = useCallback((newItem: Omit<CartItem, 'id' | 'qte'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === newItem.product_id);
      if (existing) {
        return prev.map(i =>
          i.product_id === newItem.product_id ? { ...i, qte: i.qte + 1 } : i
        );
      }
      return [...prev, { ...newItem, id: String(newItem.product_id), qte: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQte = useCallback((id: string, qte: number) => {
    if (qte <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, qte } : i));
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const clearLastOrder = useCallback(() => {
    setLastOrder(null);
  }, []);

  const total = items.reduce((sum, i) => sum + i.prix * i.qte, 0);
  const nbArticles = items.reduce((sum, i) => sum + i.qte, 0);

  const checkout = useCallback(async (): Promise<OrderData> => {
    setIsLoading(true);
    try {
      const token = await TokenStorage.getAccess();
      const response = await axios.post<OrderData>(
        `${API_BASE_URL}/boutique/commandes/`,
        {
          items: items.map(item => ({
            product_id: item.product_id,
            quantite: item.qte,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLastOrder(response.data);
      clearCart();
      return response.data;
    } finally {
      setIsLoading(false);
    }
  }, [items, clearCart]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQte, clearCart, total, nbArticles, isLoading, checkout, lastOrder, clearLastOrder }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  return useContext(CartContext);
}
