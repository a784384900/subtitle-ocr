import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const { imageData, language = '简体中文', detectBox = true } = await request.json()
    
    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }

    const zai = await ZAI.create()
    
    // Use VLM for high-quality OCR recognition
    const prompt = `你是一个专业的视频字幕识别专家。请仔细分析这张视频截图，识别其中的所有字幕文字。

要求：
1. 只识别字幕区域的文字，忽略视频画面中的其他文字（如水印、标题等）
2. 字幕通常位于视频底部，字体较大且清晰
3. 如果有多个字幕行，请分别列出
4. 返回JSON格式：{"subtitles": [{"text": "识别的文字", "confidence": 0.95, "position": {"x": 0, "y": 0, "width": 100, "height": 30}}]}
5. confidence是识别置信度(0-1)
6. position是字幕在图片中的大致位置（相对于图片尺寸的百分比）
7. 如果没有检测到字幕，返回 {"subtitles": []}
8. 语言：${language}

请只返回JSON，不要有其他说明文字。`

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { url: imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}` }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices[0]?.message?.content || '{"subtitles": []}'
    
    // Parse the JSON response
    let result
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = { subtitles: [] }
      }
    } catch {
      // If parsing fails, try to extract text directly
      result = { 
        subtitles: [{
          text: content,
          confidence: 0.8,
          position: { x: 10, y: 85, width: 80, height: 10 }
        }]
      }
    }

    return NextResponse.json({
      success: true,
      result,
      rawResponse: content
    })
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'OCR processing failed',
      success: false
    }, { status: 500 })
  }
}
