import { create } from 'zustand'

export interface SubtitleEntry {
  id: string
  startTime: number // in seconds
  endTime: number // in seconds
  text: string
  status: 'pending' | 'confirmed' | 'error'
  position?: { x: number; y: number; height: number }
  language?: string
}

export interface Task {
  id: string
  videoName: string
  videoPath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  subtitles: SubtitleEntry[]
  createdAt: Date
  updatedAt: Date
}

export interface HistoryRecord {
  id: string
  videoName: string
  videoPath: string
  subtitles: SubtitleEntry[]
  exportedFormat?: string
  createdAt: Date
}

interface AppState {
  // Current task
  currentTask: Task | null
  tasks: Task[]
  history: HistoryRecord[]
  
  // UI State
  activeMenu: string
  isProcessing: boolean
  processingProgress: number
  
  // Settings
  settings: {
    language: string
    subtitlePosition: { x: number; y: number; height: number }
    frameInterval: number
    boostMode: boolean
    showDetectionBox: boolean
  }
  
  // Actions
  setActiveMenu: (menu: string) => void
  createTask: (videoName: string, videoPath: string) => Task
  updateTask: (taskId: string, updates: Partial<Task>) => void
  deleteTask: (taskId: string) => void
  addSubtitle: (taskId: string, subtitle: SubtitleEntry) => void
  updateSubtitle: (taskId: string, subtitleId: string, updates: Partial<SubtitleEntry>) => void
  deleteSubtitle: (taskId: string, subtitleId: string) => void
  batchReplace: (taskId: string, searchText: string, replaceText: string) => void
  addToHistory: (record: HistoryRecord) => void
  clearHistory: () => void
  updateSettings: (updates: Partial<AppState['settings']>) => void
  setIsProcessing: (isProcessing: boolean) => void
  setProcessingProgress: (progress: number) => void
  setCurrentTask: (task: Task | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTask: null,
  tasks: [],
  history: [],
  activeMenu: 'subtitle-extract',
  isProcessing: false,
  processingProgress: 0,
  settings: {
    language: '简体中文',
    subtitlePosition: { x: 959, y: 1036, height: 66 },
    frameInterval: 1,
    boostMode: false,
    showDetectionBox: true,
  },
  
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  
  createTask: (videoName, videoPath) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      videoName,
      videoPath,
      status: 'pending',
      progress: 0,
      subtitles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({ 
      tasks: [...state.tasks, task],
      currentTask: task 
    }))
    return task
  },
  
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
    ),
    currentTask: state.currentTask?.id === taskId 
      ? { ...state.currentTask, ...updates, updatedAt: new Date() }
      : state.currentTask,
  })),
  
  deleteTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
    currentTask: state.currentTask?.id === taskId ? null : state.currentTask,
  })),
  
  addSubtitle: (taskId, subtitle) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId 
        ? { ...t, subtitles: [...t.subtitles, subtitle], updatedAt: new Date() }
        : t
    ),
    currentTask: state.currentTask?.id === taskId 
      ? { ...state.currentTask, subtitles: [...state.currentTask.subtitles, subtitle], updatedAt: new Date() }
      : state.currentTask,
  })),
  
  updateSubtitle: (taskId, subtitleId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId 
        ? { 
            ...t, 
            subtitles: t.subtitles.map((s) => 
              s.id === subtitleId ? { ...s, ...updates } : s
            ),
            updatedAt: new Date() 
          }
        : t
    ),
    currentTask: state.currentTask?.id === taskId 
      ? { 
          ...state.currentTask, 
          subtitles: state.currentTask.subtitles.map((s) => 
            s.id === subtitleId ? { ...s, ...updates } : s
          ),
          updatedAt: new Date() 
        }
      : state.currentTask,
  })),
  
  deleteSubtitle: (taskId, subtitleId) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId 
        ? { 
            ...t, 
            subtitles: t.subtitles.filter((s) => s.id !== subtitleId),
            updatedAt: new Date() 
          }
        : t
    ),
    currentTask: state.currentTask?.id === taskId 
      ? { 
          ...state.currentTask, 
          subtitles: state.currentTask.subtitles.filter((s) => s.id !== subtitleId),
          updatedAt: new Date() 
        }
      : state.currentTask,
  })),
  
  batchReplace: (taskId, searchText, replaceText) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId 
        ? { 
            ...t, 
            subtitles: t.subtitles.map((s) => ({
              ...s,
              text: s.text.replace(new RegExp(searchText, 'g'), replaceText),
            })),
            updatedAt: new Date() 
          }
        : t
    ),
    currentTask: state.currentTask?.id === taskId 
      ? { 
          ...state.currentTask, 
          subtitles: state.currentTask.subtitles.map((s) => ({
            ...s,
            text: s.text.replace(new RegExp(searchText, 'g'), replaceText),
          })),
          updatedAt: new Date() 
        }
      : state.currentTask,
  })),
  
  addToHistory: (record) => set((state) => ({
    history: [record, ...state.history].slice(0, 100), // Keep last 100 records
  })),
  
  clearHistory: () => set({ history: [] }),
  
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates },
  })),
  
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
  setCurrentTask: (task) => set({ currentTask: task }),
}))
