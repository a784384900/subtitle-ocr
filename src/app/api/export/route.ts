import { NextRequest, NextResponse } from 'next/server'

interface SubtitleEntry {
  id: string
  startTime: number
  endTime: number
  text: string
  status: string
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}

function formatTimeVTT(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function generateSRT(subtitles: SubtitleEntry[]): string {
  return subtitles
    .filter(s => s.text.trim())
    .map((s, i) => `${i + 1}\n${formatTime(s.startTime)} --> ${formatTime(s.endTime)}\n${s.text}\n`)
    .join('\n')
}

function generateVTT(subtitles: SubtitleEntry[]): string {
  const header = 'WEBVTT\n\n'
  const content = subtitles
    .filter(s => s.text.trim())
    .map((s, i) => `${i + 1}\n${formatTimeVTT(s.startTime)} --> ${formatTimeVTT(s.endTime)}\n${s.text}\n`)
    .join('\n')
  return header + content
}

function generateTXT(subtitles: SubtitleEntry[]): string {
  return subtitles
    .filter(s => s.text.trim())
    .map(s => s.text)
    .join('\n')
}

function generateJSON(subtitles: SubtitleEntry[]): string {
  return JSON.stringify(subtitles.filter(s => s.text.trim()), null, 2)
}

function generateASS(subtitles: SubtitleEntry[], videoName: string): string {
  const header = `[Script Info]
Title: ${videoName}
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  
  const formatASSTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const cs = Math.floor((seconds % 1) * 100)
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }
  
  const events = subtitles
    .filter(s => s.text.trim())
    .map(s => `Dialogue: 0,${formatASSTime(s.startTime)},${formatASSTime(s.endTime)},Default,,0,0,0,,${s.text}`)
    .join('\n')
  
  return header + events
}

export async function POST(request: NextRequest) {
  try {
    const { subtitles, format, videoName } = await request.json()
    
    if (!subtitles || !Array.isArray(subtitles)) {
      return NextResponse.json({ error: 'No subtitles provided' }, { status: 400 })
    }
    
    let content: string
    let mimeType: string
    let extension: string
    
    switch (format) {
      case 'srt':
        content = generateSRT(subtitles)
        mimeType = 'application/x-subrip'
        extension = 'srt'
        break
      case 'vtt':
        content = generateVTT(subtitles)
        mimeType = 'text/vtt'
        extension = 'vtt'
        break
      case 'ass':
        content = generateASS(subtitles, videoName || 'Untitled')
        mimeType = 'text/plain'
        extension = 'ass'
        break
      case 'txt':
        content = generateTXT(subtitles)
        mimeType = 'text/plain'
        extension = 'txt'
        break
      case 'json':
        content = generateJSON(subtitles)
        mimeType = 'application/json'
        extension = 'json'
        break
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      content,
      mimeType,
      extension,
      fileName: `${videoName || 'subtitles'}.${extension}`
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Export failed',
      success: false
    }, { status: 500 })
  }
}
