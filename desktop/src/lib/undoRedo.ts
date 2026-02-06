import { useState, useCallback, useRef } from 'react'

export interface UndoableAction<TResult = any> {
  id: string
  type: string
  description: string
  do: () => Promise<TResult>
  undo: () => Promise<void>
  redo?: () => Promise<TResult>
}

interface UndoRedoState<TResult> {
  past: UndoableAction<TResult>[]
  future: UndoableAction<TResult>[]
}

export function useUndoRedo<TResult = any>() {
  const [past, setPast] = useState<UndoableAction<TResult>[]>([])
  const [future, setFuture] = useState<UndoableAction<TResult>[]>([])
  const executingRef = useRef(false)

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const execute = useCallback(async (action: UndoableAction<TResult>): Promise<TResult> => {
    if (executingRef.current) {
      throw new Error('Cannot execute action while another is in progress')
    }
    executingRef.current = true
    try {
      const result = await action.do()
      setPast(prev => [...prev, action])
      setFuture([])
      return result
    } finally {
      executingRef.current = false
    }
  }, [])

  const undo = useCallback(async () => {
    if (past.length === 0 || executingRef.current) return
    executingRef.current = true
    try {
      const action = past[past.length - 1]
      await action.undo()
      setPast(prev => prev.slice(0, -1))
      setFuture(prev => [action, ...prev])
    } finally {
      executingRef.current = false
    }
  }, [past])

  const redo = useCallback(async () => {
    if (future.length === 0 || executingRef.current) return
    executingRef.current = true
    try {
      const action = future[0]
      if (action.redo) {
        await action.redo()
      } else {
        await action.do()
      }
      setPast(prev => [...prev, action])
      setFuture(prev => prev.slice(1))
    } finally {
      executingRef.current = false
    }
  }, [future])

  const clear = useCallback(() => {
    setPast([])
    setFuture([])
  }, [])

  return {
    execute,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
  }
}
