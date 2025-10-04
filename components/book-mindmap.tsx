"use client"

import { useEffect, useRef, useState } from "react"

// Dynamic import with error handling
let Tree: any = null
let treeLoaded = false

const loadTreeComponent = async () => {
  if (treeLoaded) return Tree

  try {
    const module = await import("react-d3-tree")
    Tree = module.default
    treeLoaded = true
    return Tree
  } catch (error) {
    console.error("Failed to load react-d3-tree:", error)
    return null
  }
}

interface MindMapNode {
  name: string
  children?: MindMapNode[]
  attributes?: {
    [key: string]: string | number
  }
}

interface BookMindMapProps {
  data: MindMapNode
}

export default function BookMindMap({ data }: BookMindMapProps) {
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isTreeLoaded, setIsTreeLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load the Tree component on mount
  useEffect(() => {
    loadTreeComponent()
      .then((TreeComponent) => {
        if (TreeComponent) {
          setIsTreeLoaded(true)
        } else {
          setLoadError("Failed to load mindmap component")
        }
      })
      .catch((error) => {
        console.error("Error loading Tree component:", error)
        setLoadError("Mindmap component unavailable")
      })
  }, [])

  useEffect(() => {
    if (treeContainerRef.current) {
      const { offsetWidth, offsetHeight } = treeContainerRef.current
      setDimensions({
        width: offsetWidth,
        height: offsetHeight
      })
      setTranslate({
        x: offsetWidth / 2,
        y: offsetHeight / 2
      })
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (treeContainerRef.current) {
        const { offsetWidth, offsetHeight } = treeContainerRef.current
        setDimensions({
          width: offsetWidth,
          height: offsetHeight
        })
        setTranslate({
          x: offsetWidth / 2,
          y: offsetHeight / 2
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Custom node styling
  const nodeSize = { x: 200, y: 100 }
  const separation = { siblings: 1.5, nonSiblings: 2 }

  const customNodeElement = ({ nodeDatum, toggleNode }: any) => {
    const isRoot = !nodeDatum.parent
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0
    
    return (
      <g onClick={toggleNode}>
        {/* Node background */}
        <rect
          width={180}
          height={50}
          x={-90}
          y={-25}
          rx={10}
          fill={isRoot ? "#1e40af" : hasChildren ? "#047857" : "#4338ca"}
          stroke={isRoot ? "#1d4ed8" : hasChildren ? "#059669" : "#4f46e5"}
          strokeWidth={2}
          className="cursor-pointer hover:opacity-90 transition-opacity"
          filter="url(#drop-shadow)"
        />
        
        {/* Text background for better readability */}
        <rect
          width={170}
          height={40}
          x={-85}
          y={-20}
          rx={8}
          fill="rgba(255,255,255,0.15)"
          className="pointer-events-none"
        />
        
        {/* Text shadow for better contrast */}
        <text
          x={1}
          y={6}
          textAnchor="middle"
          fontSize={13}
          fontWeight={isRoot ? "bold" : "600"}
          fill="rgba(0,0,0,0.3)"
          className="pointer-events-none select-none"
        >
          {/* Truncate long text */}
          {nodeDatum.name.length > 18 
            ? `${nodeDatum.name.substring(0, 15)}...` 
            : nodeDatum.name
          }
        </text>
        
        {/* Main node text */}
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize={13}
          fontWeight={isRoot ? "bold" : "600"}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={0.5}
          className="pointer-events-none select-none"
        >
          {/* Truncate long text */}
          {nodeDatum.name.length > 18 
            ? `${nodeDatum.name.substring(0, 15)}...` 
            : nodeDatum.name
          }
        </text>
        
        {/* Expand/collapse indicator */}
        {hasChildren && (
          <circle
            cx={75}
            cy={0}
            r={10}
            fill="#ffffff"
            stroke={isRoot ? "#1d4ed8" : hasChildren ? "#059669" : "#4f46e5"}
            strokeWidth={2}
            className="cursor-pointer hover:fill-gray-100 transition-colors"
          />
        )}
        
        {hasChildren && (
          <text
            x={75}
            y={4}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill={isRoot ? "#1d4ed8" : hasChildren ? "#059669" : "#4f46e5"}
            className="pointer-events-none select-none"
          >
            {nodeDatum.__rd3t?.collapsed ? "+" : "−"}
          </text>
        )}
      </g>
    )
  }

  // Handle loading states and errors
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">⚠️ {loadError}</p>
          <p className="text-xs text-muted-foreground">Interactive mindmap not available</p>
        </div>
      </div>
    )
  }

  if (!isTreeLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading mindmap component...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
        <p className="text-muted-foreground">No mindmap data available</p>
      </div>
    )
  }

  if (!Tree) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Mindmap component failed to load</p>
          <p className="text-xs text-muted-foreground">Please refresh the page to try again</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={treeContainerRef} className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg">
      <svg width={0} height={0}>
        <defs>
          <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>
      </svg>
      
      <Tree
        data={data}
        dimensions={dimensions}
        translate={translate}
        nodeSize={nodeSize}
        separation={separation}
        orientation="vertical"
        renderCustomNodeElement={customNodeElement}
        collapsible={true}
        initialDepth={2}
        pathFunc="step"
      />
      
      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <p className="flex items-center gap-1">
            <span>🖱️</span>
            <span>Drag to pan</span>
          </p>
          <p className="flex items-center gap-1">
            <span>🔍</span>
            <span>Scroll to zoom</span>
          </p>
          <p className="flex items-center gap-1">
            <span>📂</span>
            <span>Click nodes to expand</span>
          </p>
        </div>
      </div>
    </div>
  )
}
