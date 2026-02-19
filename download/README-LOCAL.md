# 字幕提取工具 - 本地运行指南

## 快速开始

### 1. 创建项目
```bash
npx create-next-app@latest subtitle-ocr --typescript --tailwind --eslint --app
cd subtitle-ocr
```

### 2. 安装依赖
```bash
npm install zustand lucide-react sonner z-ai-web-dev-sdk
npx shadcn@latest add button input label checkbox select scroll-area progress dialog
```

### 3. 创建文件结构
```
src/
├── lib/
│   └── store.ts          # 状态管理
├── app/
│   ├── api/
│   │   ├── ocr/
│   │   │   └── route.ts  # OCR识别API
│   │   └── export/
│   │       └── route.ts  # 导出API
│   ├── layout.tsx
│   ├── page.tsx          # 主页面
│   └── globals.css
```

### 4. 运行项目
```bash
npm run dev
```

### 5. 访问
打开浏览器访问: http://localhost:3000

## 功能说明

1. 上传视频文件
2. 点击"提取字幕"自动识别
3. 在右侧列表编辑字幕
4. 点击"导出字幕"保存为SRT格式

## 注意事项

- 需要配置 z-ai-web-dev-sdk 的 API Key
- 支持的视频格式: MP4, AVI, MOV, MKV
- 导出格式: SRT, VTT, ASS, TXT, JSON
