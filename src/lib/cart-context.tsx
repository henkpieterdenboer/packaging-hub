'use client'

import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartItem {
  productId: string
  productName: string
  articleCode: string
  supplierId: string
  supplierName: string
  quantity: number
  unit: string
  unitsPerBox: number | null
  boxesPerPallet: number | null
  pricePerUnit: number | null
}

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_ITEM'; payload: { productId: string; quantity: number; unit: string } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string } }
  | { type: 'CLEAR_SUPPLIER'; payload: { supplierId: string } }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD'; payload: CartItem[] }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (item) => item.productId === action.payload.productId,
      )
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + action.payload.quantity, unit: action.payload.unit }
              : item,
          ),
        }
      }
      return { items: [...state.items, action.payload] }
    }

    case 'UPDATE_ITEM':
      return {
        items: state.items.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, quantity: action.payload.quantity, unit: action.payload.unit }
            : item,
        ),
      }

    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (item) => item.productId !== action.payload.productId,
        ),
      }

    case 'CLEAR_SUPPLIER':
      return {
        items: state.items.filter(
          (item) => item.supplierId !== action.payload.supplierId,
        ),
      }

    case 'CLEAR_ALL':
      return { items: [] }

    case 'LOAD':
      return { items: action.payload }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CartContextValue {
  items: CartItem[]
  totalItems: number
  addItem: (item: CartItem) => void
  updateItem: (productId: string, quantity: number, unit: string) => void
  removeItem: (productId: string) => void
  clearSupplier: (supplierId: string) => void
  clearAll: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'supplyhub-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items = JSON.parse(stored) as CartItem[]
        if (Array.isArray(items)) {
          dispatch({ type: 'LOAD', payload: items })
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch {
      // Ignore storage errors
    }
  }, [state.items])

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item })
  }, [])

  const updateItem = useCallback((productId: string, quantity: number, unit: string) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { productId, quantity, unit } })
  }, [])

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId } })
  }, [])

  const clearSupplier = useCallback((supplierId: string) => {
    dispatch({ type: 'CLEAR_SUPPLIER', payload: { supplierId } })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        totalItems,
        addItem,
        updateItem,
        removeItem,
        clearSupplier,
        clearAll,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
