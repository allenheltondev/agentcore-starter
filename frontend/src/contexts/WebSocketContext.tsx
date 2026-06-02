import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { WebSocketService } from '../services/websocket'
import { useAuth } from './AuthContext'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface WebSocketContextType {
  wsService: WebSocketService
  connectionStatus: ConnectionStatus
  sendMessage: (text: string, sessionId: string, userId?: string) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const wsServiceRef = useRef<WebSocketService>(new WebSocketService())

  const connectWebSocket = useCallback(async () => {
    try {
      setConnectionStatus('connecting')
      wsServiceRef.current.disconnect()
      await wsServiceRef.current.connect()
      setConnectionStatus('connected')
      console.log('WebSocket connection ready')
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
      setConnectionStatus('disconnected')
    }
  }, [])

  // Connect when user is authenticated
  useEffect(() => {
    if (user !== null && !isLoading) {
      connectWebSocket()
    }

    if (user === null && !isLoading) {
      wsServiceRef.current.disconnect()
      setConnectionStatus('disconnected')
    }
  }, [user, isLoading, connectWebSocket])

  // Listen for close events from the WebSocket service
  useEffect(() => {
    const handleClose = () => {
      setConnectionStatus('disconnected')
    }

    const wsService = wsServiceRef.current
    wsService.on('close', handleClose)

    return () => {
      wsService.off('close', handleClose)
    }
  }, [])

  // Reconnect on visibility change or network restore
  useEffect(() => {
    if (!user || isLoading) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wsServiceRef.current.isConnected()) {
        console.log('Tab active — reconnecting WebSocket')
        connectWebSocket()
      }
    }

    const handleOnline = () => {
      if (!wsServiceRef.current.isConnected()) {
        console.log('Network restored — reconnecting WebSocket')
        connectWebSocket()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [user, isLoading, connectWebSocket])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsServiceRef.current.disconnect()
    }
  }, [])

  const sendMessage = useCallback((text: string, sessionId: string, userId?: string) => {
    wsServiceRef.current.sendQuery(text, sessionId, userId)
  }, [])

  const value: WebSocketContextType = {
    wsService: wsServiceRef.current,
    connectionStatus,
    sendMessage
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
