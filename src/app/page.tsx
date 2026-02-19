'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, SubtitleEntry } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Play, Pause, SkipBack, SkipForward, Square, Plus, Search, Settings, 
  History, FileText, Upload, Download, Trash2, Edit, AlertCircle, Check, 
  ChevronLeft, ChevronRight, Copy, RefreshCw, X, Save
} from 'lucide-react'
import { toast } from 'sonner'

// Format time to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Parse time string to seconds
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

export default function SubtitleOCRApp() {
  const {
    currentTask,
    tasks,
    history,
    activeMenu,
    isProcessing,
    processingProgress,
    settings,
    setActiveMenu,
    createTask,
    updateTask,
    deleteTask,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    batchReplace,
    addToHistory,
    clearHistory,
    updateSettings,
    setIsProcessing,
    setProcessingProgress,
    setCurrentTask,
  } = useAppStore()

  // Local state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null)
  const [showBatchReplace, setShowBatchReplace] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [exportFormat, setExportFormat] = useState('srt')
  const [frameInterval, setFrameInterval] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Menu items
  const menuItems = [
    { id: 'subtitle-extract', label: '字幕提取', icon: FileText },
    { id: 'task-list', label: '任务列表', icon: FileText },
    { id: 'batch-replace', label: '批量替换', icon: Search },
    { id: 'history', label: '历史记录', icon: History },
    { id: 'settings', label: '设置', icon: Settings },
  ]

  // Handle video file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      
      // Create new task
      const task = createTask(file.name, url)
      setActiveMenu('subtitle-extract')
      
      toast.success(`已加载视频: ${file.name}`)
    }
  }

  // Video playback controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Extract frame from video
  const extractFrame = useCallback((time: number): string | null => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return null
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  // OCR processing
  const processOCR = async (imageData: string): Promise<{ text: string; confidence: number } | null> => {
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          language: settings.language,
          detectBox: settings.showDetectionBox,
        }),
      })
      
      const data = await response.json()
      
      if (data.success && data.result?.subtitles?.length > 0) {
        return {
          text: data.result.subtitles[0].text,
          confidence: data.result.subtitles[0].confidence,
        }
      }
      return null
    } catch (error) {
      console.error('OCR error:', error)
      return null
    }
  }

  // Start subtitle extraction
  const startExtraction = async () => {
    if (!videoFile || !currentTask) {
      toast.error('请先选择视频文件')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)
    updateTask(currentTask.id, { status: 'processing', subtitles: [] })

    const interval = frameInterval // seconds between frames
    const totalFrames = Math.floor(duration / interval)
    const extractedSubtitles: SubtitleEntry[] = []
    let lastText = ''

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (!isProcessing) break // Allow stopping

        const time = i * interval
        
        // Seek to frame
        if (videoRef.current) {
          videoRef.current.currentTime = time
          await new Promise(resolve => setTimeout(resolve, 100)) // Wait for frame to load
        }

        // Extract frame
        const frameData = extractFrame(time)
        if (!frameData) continue

        // Process OCR
        const result = await processOCR(frameData)
        
        if (result && result.text && result.text !== lastText) {
          lastText = result.text
          
          const subtitle: SubtitleEntry = {
            id: `sub-${Date.now()}-${i}`,
            startTime: time,
            endTime: time + interval,
            text: result.text,
            status: result.confidence > 0.9 ? 'confirmed' : 'pending',
            position: settings.subtitlePosition,
            language: settings.language,
          }
          
          extractedSubtitles.push(subtitle)
          addSubtitle(currentTask.id, subtitle)
        }

        setProcessingProgress(((i + 1) / totalFrames) * 100)
      }

      updateTask(currentTask.id, { status: 'completed', progress: 100 })
      toast.success(`提取完成，共识别 ${extractedSubtitles.length} 条字幕`)
      
      // Add to history
      addToHistory({
        id: `history-${Date.now()}`,
        videoName: videoFile.name,
        videoPath: videoUrl,
        subtitles: extractedSubtitles,
        createdAt: new Date(),
      })
    } catch (error) {
      console.error('Extraction error:', error)
      updateTask(currentTask.id, { status: 'error' })
      toast.error('提取过程中发生错误')
    } finally {
      setIsProcessing(false)
    }
  }

  // Stop extraction
  const stopExtraction = () => {
    setIsProcessing(false)
    if (currentTask) {
      updateTask(currentTask.id, { status: 'pending' })
    }
    toast.info('已停止提取')
  }

  // Export subtitles
  const exportSubtitles = async () => {
    if (!currentTask || currentTask.subtitles.length === 0) {
      toast.error('没有可导出的字幕')
      return
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: currentTask.subtitles,
          format: exportFormat,
          videoName: videoFile?.name?.replace(/\.[^/.]+$/, '') || 'subtitles',
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Download file
        const blob = new Blob([data.content], { type: data.mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.fileName
        a.click()
        URL.revokeObjectURL(url)
        
        toast.success(`已导出为 ${exportFormat.toUpperCase()} 格式`)
        setShowExport(false)
      }
    } catch (error) {
      toast.error('导出失败')
    }
  }

  // Batch replace
  const handleBatchReplace = () => {
    if (!currentTask || !searchText) return
    
    const count = currentTask.subtitles.filter(s => s.text.includes(searchText)).length
    batchReplace(currentTask.id, searchText, replaceText)
    toast.success(`已替换 ${count} 处文本`)
    setShowBatchReplace(false)
    setSearchText('')
    setReplaceText('')
  }

  // Add subtitle manually
  const addSubtitleManually = () => {
    if (!currentTask) return
    
    const newSubtitle: SubtitleEntry = {
      id: `sub-${Date.now()}`,
      startTime: currentTime,
      endTime: currentTime + 2,
      text: '',
      status: 'pending',
      position: settings.subtitlePosition,
      language: settings.language,
    }
    
    addSubtitle(currentTask.id, newSubtitle)
    setSelectedSubtitle(newSubtitle.id)
  }

  // Analyze current frame
  const analyzeCurrentFrame = async () => {
    if (!videoRef.current) return
    
    const frameData = extractFrame(currentTime)
    if (!frameData) return
    
    toast.info('正在识别当前帧...')
    
    const result = await processOCR(frameData)
    if (result && result.text) {
      const newSubtitle: SubtitleEntry = {
        id: `sub-${Date.now()}`,
        startTime: currentTime,
        endTime: currentTime + 2,
        text: result.text,
        status: result.confidence > 0.9 ? 'confirmed' : 'pending',
        position: settings.subtitlePosition,
        language: settings.language,
      }
      
      if (currentTask) {
        addSubtitle(currentTask.id, newSubtitle)
      }
      
      toast.success(`识别结果: ${result.text}`)
    } else {
      toast.warning('未检测到字幕')
    }
  }

  // Jump to subtitle time
  const jumpToSubtitle = (subtitle: SubtitleEntry) => {
    if (videoRef.current) {
      videoRef.current.currentTime = subtitle.startTime
      setSelectedSubtitle(subtitle.id)
    }
  }

  // Render content based on active menu
  const renderContent = () => {
    switch (activeMenu) {
      case 'task-list':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <h2 className="text-xl font-semibold mb-4">任务列表</h2>
            {tasks.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                暂无任务，请先上传视频
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      currentTask?.id === task.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setCurrentTask(task)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{task.videoName}</div>
                        <div className="text-sm text-gray-500">
                          {task.subtitles.length} 条字幕 · {task.status === 'completed' ? '已完成' : task.status === 'processing' ? '处理中' : '待处理'}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTask(task.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      
      case 'batch-replace':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <h2 className="text-xl font-semibold mb-4">批量替换</h2>
            <div className="max-w-md space-y-4">
              <div>
                <Label>查找内容</Label>
                <Input 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="输入要查找的文本"
                />
              </div>
              <div>
                <Label>替换为</Label>
                <Input 
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="输入替换后的文本"
                />
              </div>
              <Button onClick={handleBatchReplace} disabled={!searchText || !currentTask}>
                执行替换
              </Button>
            </div>
          </div>
        )
      
      case 'history':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">历史记录</h2>
              {history.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearHistory}>
                  清空记录
                </Button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                暂无历史记录
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(record => (
                  <div key={record.id} className="p-4 border rounded-lg">
                    <div className="font-medium">{record.videoName}</div>
                    <div className="text-sm text-gray-500">
                      {record.subtitles.length} 条字幕 · {new Date(record.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      
      case 'settings':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <h2 className="text-xl font-semibold mb-4">设置</h2>
            <div className="max-w-md space-y-6">
              <div>
                <Label>识别语言</Label>
                <Select value={settings.language} onValueChange={(v) => updateSettings({ language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="简体中文">简体中文</SelectItem>
                    <SelectItem value="繁体中文">繁体中文</SelectItem>
                    <SelectItem value="英文">英文</SelectItem>
                    <SelectItem value="日文">日文</SelectItem>
                    <SelectItem value="韩文">韩文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>帧间隔（秒）</Label>
                <Input 
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={frameInterval}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setFrameInterval(val)
                    updateSettings({ frameInterval: val })
                  }}
                />
                <p className="text-sm text-gray-500 mt-1">较小的间隔可提高识别精度，但会增加处理时间</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="showDetectionBox"
                  checked={settings.showDetectionBox}
                  onCheckedChange={(checked) => updateSettings({ showDetectionBox: !!checked })}
                />
                <Label htmlFor="showDetectionBox">显示检测框</Label>
              </div>
              
              <div>
                <Label>字幕位置 X</Label>
                <Input 
                  type="number"
                  value={settings.subtitlePosition.x}
                  onChange={(e) => updateSettings({ 
                    subtitlePosition: { ...settings.subtitlePosition, x: parseInt(e.target.value) } 
                  })}
                />
              </div>
              
              <div>
                <Label>字幕位置 Y</Label>
                <Input 
                  type="number"
                  value={settings.subtitlePosition.y}
                  onChange={(e) => updateSettings({ 
                    subtitlePosition: { ...settings.subtitlePosition, y: parseInt(e.target.value) } 
                  })}
                />
              </div>
              
              <div>
                <Label>字幕高度</Label>
                <Input 
                  type="number"
                  value={settings.subtitlePosition.height}
                  onChange={(e) => updateSettings({ 
                    subtitlePosition: { ...settings.subtitlePosition, height: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div className="flex-1 flex flex-col">
            {/* Video Area */}
            <div className="relative bg-black aspect-video max-h-[50vh] flex items-center justify-center">
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="max-w-full max-h-full"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </>
              ) : (
                <div 
                  className="flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:text-gray-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-16 w-16 mb-4" />
                  <span className="text-lg">点击选择视频文件</span>
                  <span className="text-sm mt-2">支持 MP4, AVI, MOV, MKV 等格式</span>
                </div>
              )}
            </div>
            
            {/* Video Controls */}
            {videoUrl && (
              <div className="bg-gray-100 p-3 space-y-2">
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <span className="text-sm w-16">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-2 cursor-pointer"
                  />
                  <span className="text-sm w-16 text-right">{formatTime(duration)}</span>
                </div>
                
                {/* Control buttons */}
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => seek(-10)}>
                    <ChevronLeft className="h-4 w-4" />
                    10S
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seek(-1)}>
                    -1S
                  </Button>
                  <Button variant="default" size="sm" onClick={togglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seek(1)}>
                    +1S
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seek(10)}>
                    10S
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="bg-gray-50 p-3 border-b">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  选择文件
                </Button>
                
                {isProcessing ? (
                  <Button variant="destructive" onClick={stopExtraction}>
                    <Square className="h-4 w-4 mr-2" />
                    停止任务
                  </Button>
                ) : (
                  <Button onClick={startExtraction} disabled={!videoFile}>
                    <Play className="h-4 w-4 mr-2" />
                    提取字幕
                  </Button>
                )}
                
                <Button variant="outline" onClick={addSubtitleManually} disabled={!videoFile}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加字幕行
                </Button>
                
                <Button variant="outline" onClick={analyzeCurrentFrame} disabled={!videoFile}>
                  <Search className="h-4 w-4 mr-2" />
                  分析当前帧
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowExport(true)}
                  disabled={!currentTask || currentTask.subtitles.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出字幕
                </Button>
              </div>
              
              {/* Processing progress */}
              {isProcessing && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>提取进度</span>
                    <span>{processingProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={processingProgress} />
                </div>
              )}
            </div>
            
            {/* Subtitle editing area */}
            {selectedSubtitle && currentTask && (
              <div className="bg-white p-3 border-b">
                {currentTask.subtitles
                  .filter(s => s.id === selectedSubtitle)
                  .map(subtitle => (
                    <div key={subtitle.id} className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">开始时间</Label>
                          <Input
                            value={formatTime(subtitle.startTime)}
                            onChange={(e) => {
                              const time = parseTime(e.target.value)
                              updateSubtitle(currentTask.id, subtitle.id, { startTime: time })
                            }}
                            className="h-8"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">结束时间</Label>
                          <Input
                            value={formatTime(subtitle.endTime)}
                            onChange={(e) => {
                              const time = parseTime(e.target.value)
                              updateSubtitle(currentTask.id, subtitle.id, { endTime: time })
                            }}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">字幕内容</Label>
                        <Input
                          value={subtitle.text}
                          onChange={(e) => updateSubtitle(currentTask.id, subtitle.id, { text: e.target.value })}
                          placeholder="输入字幕内容"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateSubtitle(currentTask.id, subtitle.id, { status: 'confirmed' })}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          确认
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateSubtitle(currentTask.id, subtitle.id, { status: 'error' })}
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          标记错误
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            deleteSubtitle(currentTask.id, subtitle.id)
                            setSelectedSubtitle(null)
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Subtitle info */}
            {currentTask && (
              <div className="bg-gray-50 px-3 py-2 text-sm text-gray-600 border-b">
                提取字幕 [x{settings.frameInterval}] {formatTime(currentTime)} / {formatTime(duration)} · 
                共 {currentTask.subtitles.length} 条字幕
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-48 bg-gray-50 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">字幕提取工具</h1>
          <p className="text-xs text-gray-500 mt-1">Subtitle OCR</p>
        </div>
        <nav className="flex-1 p-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                activeMenu === item.id 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t text-xs text-gray-500">
          <p>版本: 1.0.0</p>
          <p>引擎: VLM OCR</p>
        </div>
      </div>
      
      {/* Main Content */}
      {renderContent()}
      
      {/* Right Sidebar - Subtitle List */}
      {activeMenu === 'subtitle-extract' && (
        <div className="w-72 bg-white border-l flex flex-col">
          <div className="p-3 border-b font-medium">
            字幕列表 ({currentTask?.subtitles.length || 0})
          </div>
          <ScrollArea className="flex-1">
            {currentTask && currentTask.subtitles.length > 0 ? (
              <div className="divide-y">
                {currentTask.subtitles.map((subtitle, index) => (
                  <div
                    key={subtitle.id}
                    onClick={() => jumpToSubtitle(subtitle)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedSubtitle === subtitle.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span>{formatTime(subtitle.startTime)}</span>
                      <span>→</span>
                      <span>{formatTime(subtitle.endTime)}</span>
                      {subtitle.status === 'error' && (
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                      )}
                      {subtitle.status === 'confirmed' && (
                        <Check className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                    <div className="text-sm line-clamp-2">{subtitle.text || '(空)'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                暂无字幕<br />
                <span className="text-xs">上传视频后点击"提取字幕"</span>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
      
      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出字幕</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>导出格式</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="srt">SRT (SubRip)</SelectItem>
                  <SelectItem value="vtt">VTT (WebVTT)</SelectItem>
                  <SelectItem value="ass">ASS (Advanced SubStation)</SelectItem>
                  <SelectItem value="txt">TXT (纯文本)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-500">
              共 {currentTask?.subtitles.length || 0} 条字幕将被导出
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>取消</Button>
            <Button onClick={exportSubtitles}>导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
