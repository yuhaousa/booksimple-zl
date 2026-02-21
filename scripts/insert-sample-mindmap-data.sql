-- Insert sample AI analysis data for testing mind map
-- STEP 1: First, find your user_id and book_id by running these queries:

-- Find your user ID
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Find your book ID  
-- SELECT id, title FROM "Booklist" ORDER BY created_at DESC LIMIT 10;

-- STEP 2: Replace the values below with your actual IDs, then run this insert

-- Example 1: Technical book structure
INSERT INTO ai_book_analysis (
  book_id,
  user_id,
  summary,
  content_analysis,
  mind_map_data,
  content_hash
) VALUES (
  63, -- ⚠️ REPLACE with your actual book_id from the query above
  (SELECT id FROM auth.users LIMIT 1), -- ⚠️ This gets the first user, or replace with your specific user_id
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

-- Example 2: Business book structure
-- Uncomment and modify if you need another example
/*
INSERT INTO ai_book_analysis (
  book_id,
  user_id,
  summary,
  content_analysis,
  mind_map_data,
  content_hash
) VALUES (
  64, -- ⚠️ Replace with your actual book_id
  (SELECT id FROM auth.users LIMIT 1), -- ⚠️ This gets the first user, or replace with your specific user_id
  '这是一本关于创新与创业的实战指南，作者通过精益创业方法论，帮助创业者降低风险、快速验证商业假设。',
  '{
    "main_topics": [
      {
        "name": "精益创业核心理念",
        "subtopics": [
          "最小可行产品（MVP）",
          "验证式学习",
          "快速迭代"
        ]
      },
      {
        "name": "商业模式画布",
        "subtopics": [
          "价值主张",
          "客户细分",
          "渠道通路",
          "收入来源"
        ]
      },
      {
        "name": "增长黑客",
        "subtopics": [
          "病毒式传播",
          "用户留存",
          "数据驱动决策"
        ]
      }
    ],
    "key_concepts": [
      "精益创业",
      "MVP",
      "迭代验证",
      "增长黑客",
      "用户反馈"
    ]
  }'::jsonb,
  '{
    "main_topics": [
      {
        "name": "精益创业核心理念",
        "subtopics": [
          "最小可行产品（MVP）",
          "验证式学习",
          "快速迭代"
        ]
      },
      {
        "name": "商业模式画布",
        "subtopics": [
          "价值主张",
          "客户细分",
          "渠道通路",
          "收入来源"
        ]
      },
      {
        "name": "增长黑客",
        "subtopics": [
          "病毒式传播",
          "用户留存",
          "数据驱动决策"
        ]
      }
    ],
    "key_concepts": [
      "精益创业",
      "MVP",
      "迭代验证",
      "增长黑客",
      "用户反馈"
    ]
  }'::jsonb,
  'sample_hash_' || md5(random()::text)
);
*/

-- Verify the insert
SELECT 
  id,
  book_id,
  summary,
  content_analysis,
  mind_map_data,
  created_at
FROM ai_book_analysis
WHERE book_id IN (63)
ORDER BY created_at DESC
LIMIT 5;
