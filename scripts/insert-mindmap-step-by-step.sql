-- Step-by-step guide to insert mind map data

-- ============================================
-- STEP 1: Find your user ID
-- ============================================
-- Copy one of the user IDs from the results
SELECT 
  id as user_id, 
  email, 
  created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================
-- STEP 2: Find your book ID  
-- ============================================
-- Copy the book ID you want to add mind map data for
SELECT 
  id as book_id, 
  title, 
  author,
  created_at 
FROM "Booklist" 
ORDER BY created_at DESC 
LIMIT 20;

-- ============================================
-- STEP 3: Insert the mind map data
-- ============================================
-- Replace YOUR_BOOK_ID and YOUR_USER_ID with the actual values from above

INSERT INTO ai_book_analysis (
  book_id,
  user_id,
  summary,
  content_analysis,
  mind_map_data,
  content_hash
) VALUES (
  YOUR_BOOK_ID, -- Replace this with the book_id from STEP 2
  'YOUR_USER_ID', -- Replace this with the user_id from STEP 1
  '本书是一本深入探讨技术本质的经典著作，通过对技术发展历程的分析，揭示了技术演进的内在规律。作者将技术的定义、技术的进化、技术与科学的关系等核心问题进行了系统阐述，为读者提供了全新的技术哲学视角。',
  '{
    "chapters": [
      {
        "title": "1. 技术的定义",
        "sections": [
          "实现目的的手段",
          "实践和元器件的集成",
          "文化中利用的装置和工程实践的集合"
        ],
        "key_points": [
          "技术是实现人类目的的手段",
          "技术由实践方法和具体装置组成",
          "技术是特定文化背景下的产物"
        ]
      },
      {
        "title": "2. 技术的进化",
        "sections": [
          "组合原理",
          "结构与逻辑",
          "递归性结构",
          "模块化"
        ],
        "key_points": [
          "所有技术都是现有技术的组合",
          "技术组件本身也是技术",
          "利用或开发自然现象",
          "技术依赖现象实现"
        ]
      },
      {
        "title": "3. 技术与科学",
        "sections": [
          "科学是技术的副产品",
          "技术推动科学进步",
          "技术提供观象实例",
          "具体例子"
        ],
        "key_points": [
          "最基本结构：主集成+支撑集成",
          "递归性结构：包含技术的技术",
          "技术依赖现象",
          "现象应用"
        ]
      }
    ],
    "key_concepts": [
      "组合原理",
      "递归结构",
      "模块化",
      "技术依赖现象",
      "科学技术关系"
    ],
    "main_themes": [
      "技术本质探讨",
      "技术演进规律",
      "技术与科学互动",
      "技术哲学思考"
    ]
  }'::jsonb,
  '{
    "chapters": [
      {
        "title": "1. 技术的定义",
        "sections": [
          "实现目的的手段",
          "实践和元器件的集成",
          "文化中利用的装置和工程实践的集合"
        ],
        "key_points": [
          "技术是实现人类目的的手段",
          "技术由实践方法和具体装置组成",
          "技术是特定文化背景下的产物"
        ]
      },
      {
        "title": "2. 技术的进化",
        "sections": [
          "组合原理",
          "结构与逻辑",
          "递归性结构",
          "模块化"
        ],
        "key_points": [
          "所有技术都是现有技术的组合",
          "技术组件本身也是技术",
          "利用或开发自然现象",
          "技术依赖现象实现"
        ]
      },
      {
        "title": "3. 技术与科学",
        "sections": [
          "科学是技术的副产品",
          "技术推动科学进步",
          "技术提供观象实例",
          "具体例子"
        ],
        "key_points": [
          "最基本结构：主集成+支撑集成",
          "递归性结构：包含技术的技术",
          "技术依赖现象",
          "现象应用"
        ]
      }
    ],
    "key_concepts": [
      "组合原理",
      "递归结构",
      "模块化",
      "技术依赖现象",
      "科学技术关系"
    ],
    "main_themes": [
      "技术本质探讨",
      "技术演进规律",
      "技术与科学互动",
      "技术哲学思考"
    ]
  }'::jsonb,
  'sample_hash_' || md5(random()::text)
) ON CONFLICT (book_id, content_hash) DO UPDATE SET
  summary = EXCLUDED.summary,
  content_analysis = EXCLUDED.content_analysis,
  mind_map_data = EXCLUDED.mind_map_data,
  updated_at = now();

-- ============================================
-- STEP 4: Verify the insert worked
-- ============================================
SELECT 
  id,
  book_id,
  summary,
  mind_map_data IS NOT NULL as has_mindmap_data,
  created_at
FROM ai_book_analysis
WHERE book_id = YOUR_BOOK_ID  -- Replace with your book_id
ORDER BY created_at DESC;
