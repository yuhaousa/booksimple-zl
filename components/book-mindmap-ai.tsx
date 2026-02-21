'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  level: number
}

interface BookMindMapAIProps {
  bookTitle: string
  aiOutline: any
  aiGuide?: string
}

export default function BookMindMapAI({ bookTitle, aiOutline, aiGuide }: BookMindMapAIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null)

  // Generate mind map structure from AI outline
  useEffect(() => {
    if (!aiOutline) return

    const generateMindMap = (): MindMapNode => {
      const rootNode: MindMapNode = {
        id: 'root',
        label: bookTitle || '图书分析',
        level: 0,
        children: []
      }

      try {
        // Parse AI outline if it's a string
        const outline = typeof aiOutline === 'string' ? JSON.parse(aiOutline) : aiOutline

        // Extract main sections
        if (outline.chapters && Array.isArray(outline.chapters)) {
          outline.chapters.forEach((chapter: any, index: number) => {
            const chapterNode: MindMapNode = {
              id: `chapter-${index}`,
              label: chapter.title || `第${index + 1}章`,
              level: 1,
              children: []
            }

            // Add subsections if available
            if (chapter.sections && Array.isArray(chapter.sections)) {
              chapter.sections.forEach((section: any, sIndex: number) => {
                chapterNode.children!.push({
                  id: `section-${index}-${sIndex}`,
                  label: typeof section === 'string' ? section : section.title || section.name,
                  level: 2,
                  children: []
                })
              })
            } else if (chapter.key_points && Array.isArray(chapter.key_points)) {
              chapter.key_points.forEach((point: string, pIndex: number) => {
                chapterNode.children!.push({
                  id: `point-${index}-${pIndex}`,
                  label: point,
                  level: 2,
                  children: []
                })
              })
            }

            rootNode.children!.push(chapterNode)
          })
        } else if (outline.main_topics && Array.isArray(outline.main_topics)) {
          // Alternative structure
          outline.main_topics.forEach((topic: any, index: number) => {
            const topicNode: MindMapNode = {
              id: `topic-${index}`,
              label: typeof topic === 'string' ? topic : topic.name || topic.title,
              level: 1,
              children: []
            }

            if (typeof topic === 'object' && topic.subtopics) {
              topic.subtopics.forEach((subtopic: any, sIndex: number) => {
                topicNode.children!.push({
                  id: `subtopic-${index}-${sIndex}`,
                  label: typeof subtopic === 'string' ? subtopic : subtopic.name,
                  level: 2,
                  children: []
                })
              })
            }

            rootNode.children!.push(topicNode)
          })
        } else {
          // Generic object structure
          Object.entries(outline).forEach(([key, value]: [string, any], index) => {
            if (key === 'key_concepts' || key === 'title' || key === 'summary') return

            const mainNode: MindMapNode = {
              id: `node-${index}`,
              label: key.replace(/_/g, ' '),
              level: 1,
              children: []
            }

            if (Array.isArray(value)) {
              value.slice(0, 5).forEach((item: any, subIndex: number) => {
                mainNode.children!.push({
                  id: `node-${index}-${subIndex}`,
                  label: typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item).slice(0, 30),
                  level: 2,
                  children: []
                })
              })
            } else if (typeof value === 'string') {
              mainNode.children!.push({
                id: `node-${index}-0`,
                label: value.length > 50 ? value.slice(0, 50) + '...' : value,
                level: 2,
                children: []
              })
            }

            if (mainNode.children!.length > 0) {
              rootNode.children!.push(mainNode)
            }
          })
        }

        // If no children were added, create a simple structure
        if (rootNode.children!.length === 0) {
          rootNode.children!.push({
            id: 'placeholder',
            label: '暂无详细大纲',
            level: 1,
            children: []
          })
        }
      } catch (error) {
        console.error('Error parsing AI outline:', error)
        rootNode.children!.push({
          id: 'error',
          label: '大纲解析失败',
          level: 1,
          children: []
        })
      }

      return rootNode
    }

    setMindMapData(generateMindMap())
  }, [aiOutline, bookTitle])

  // Draw the mind map
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !mindMapData) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Apply transformations
    ctx.save()
    ctx.translate(rect.width / 2 + offset.x, rect.height / 2 + offset.y)
    ctx.scale(scale, scale)

    // Drawing configuration - increased spacing to prevent overlaps
    const nodeWidth = 180
    const nodeHeight = 40
    const levelSpacing = 280  // Increased horizontal spacing between levels
    const baseSiblingSpacing = 100  // Increased base vertical spacing between siblings

    // Calculate the height needed for a subtree
    const calculateSubtreeHeight = (node: MindMapNode): number => {
      if (!node.children || node.children.length === 0) {
        return baseSiblingSpacing
      }
      
      let totalHeight = 0
      node.children.forEach(child => {
        totalHeight += calculateSubtreeHeight(child)
      })
      
      return Math.max(totalHeight, baseSiblingSpacing)
    }

    // Calculate node positions - horizontal layout from left to right with proper spacing
    const calculatePositions = (
      node: MindMapNode, 
      x: number, 
      y: number, 
      parentX?: number, 
      parentY?: number
    ): Array<{ node: MindMapNode; x: number; y: number; parentX?: number; parentY?: number }> => {
      const positions: Array<{ node: MindMapNode; x: number; y: number; parentX?: number; parentY?: number }> = []

      positions.push({ node, x, y, parentX, parentY })

      if (node.children && node.children.length > 0) {
        // Calculate total height needed for all children
        const childHeights = node.children.map(child => calculateSubtreeHeight(child))
        const totalHeight = childHeights.reduce((sum, h) => sum + h, 0)
        
        // Start position for first child
        let currentY = y - totalHeight / 2
        
        node.children.forEach((child, index) => {
          const childHeight = childHeights[index]
          const childY = currentY + childHeight / 2
          const childX = x + levelSpacing
          
          positions.push(...calculatePositions(child, childX, childY, x, y))
          
          currentY += childHeight
        })
      }

      return positions
    }

    // Start from left side of canvas
    const startX = -rect.width / 2 + 120
    const positions = calculatePositions(mindMapData, startX, 0)

    // Draw connections first (curved lines)
    positions.forEach((pos) => {
      if (pos.parentX !== undefined && pos.parentY !== undefined) {
        ctx.beginPath()
        ctx.strokeStyle = getNodeColor(pos.node.level)
        ctx.lineWidth = 1.5
        ctx.setLineDash([])

        // Draw smooth Bezier curve from parent to child (horizontal)
        const dx = pos.x - pos.parentX
        const controlPointOffset = dx * 0.5
        
        ctx.moveTo(pos.parentX, pos.parentY)
        ctx.bezierCurveTo(
          pos.parentX + controlPointOffset, pos.parentY,
          pos.x - controlPointOffset, pos.y,
          pos.x - 8, pos.y
        )
        ctx.stroke()

        // Draw small circle at child node connection point
        ctx.beginPath()
        ctx.arc(pos.x - 8, pos.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = getNodeColor(pos.node.level)
        ctx.fill()
      }
    })

    // Draw nodes with backgrounds
    positions.forEach(pos => {
      const { node, x, y } = pos
      const text = node.label
      const maxTextLength = 40 // Truncate long text

      // Truncate text if too long
      const displayText = text.length > maxTextLength ? text.substring(0, maxTextLength) + '...' : text

      // Measure text
      ctx.font = node.level === 0 ? 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 
                 node.level === 1 ? '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 
                 '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      const metrics = ctx.measureText(displayText)
      const textWidth = metrics.width
      const padding = node.level === 0 ? 14 : 10

      // Draw node background
      if (node.level === 0) {
        // Root node - rounded rectangle with gradient
        const boxWidth = textWidth + padding * 2
        const boxHeight = 36

        const gradient = ctx.createLinearGradient(x, y - boxHeight / 2, x, y + boxHeight / 2)
        gradient.addColorStop(0, '#f0f9ff')
        gradient.addColorStop(1, '#e0f2fe')
        
        ctx.fillStyle = gradient
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y - boxHeight / 2, boxWidth, boxHeight, 8)
        ctx.fill()
        ctx.stroke()

        // Draw text
        ctx.fillStyle = '#0c4a6e'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(displayText, x + padding, y)
      } else if (node.level === 1) {
        // Level 1 nodes - subtle background
        const boxWidth = textWidth + padding * 2
        const boxHeight = 28

        ctx.fillStyle = '#fefce8'
        ctx.strokeStyle = '#eab308'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(x, y - boxHeight / 2, boxWidth, boxHeight, 6)
        ctx.fill()
        ctx.stroke()

        // Draw text
        ctx.fillStyle = '#713f12'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(displayText, x + padding, y)
      } else {
        // Level 2+ nodes - minimal style, just text with subtle background
        const boxWidth = textWidth + padding * 2
        const boxHeight = 24

        ctx.fillStyle = '#f8fafc'
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(x, y - boxHeight / 2, boxWidth, boxHeight, 4)
        ctx.fill()
        ctx.stroke()

        // Draw text
        ctx.fillStyle = '#475569'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(displayText, x + padding, y)
      }
    })

    ctx.restore()

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        canvas.style.width = rect.width + 'px'
        canvas.style.height = rect.height + 'px'
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mindMapData, scale, offset])

  const getNodeColor = (level: number): string => {
    const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7']
    return colors[Math.min(level, colors.length - 1)]
  }

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5))
  const handleReset = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `${bookTitle}-mindmap.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
  }

  if (!mindMapData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">正在生成思维导图...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button size="sm" variant="outline" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset}>
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
