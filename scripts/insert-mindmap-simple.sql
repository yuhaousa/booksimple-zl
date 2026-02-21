-- Simple Mind Map Data Insert
-- Instructions: Replace the three values marked with ⚠️ below

-- First, find your IDs by running these queries separately:
-- User ID: SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
-- Book ID: SELECT id, title FROM "Booklist" ORDER BY created_at DESC LIMIT 10;

-- Then replace the values and run this INSERT:

INSERT INTO ai_book_analysis (
  book_id,
  user_id,
  summary,
  content_analysis,
  mind_map_data,
  content_hash
) VALUES (
  63, -- ⚠️ REPLACE THIS: Put your book_id here (number without quotes)
  '4b8e5c2a-1234-5678-9abc-def012345678', -- ⚠️ REPLACE THIS: Put your user_id here (UUID with quotes)
  '本书是一本深入探讨技术本质的经典著作，通过对技术发展历程的分析，揭示了技术演进的内在规律。作者将技术的定义、技术的进化、技术与科学的关系等核心问题进行了系统阐述，为读者提供了全新的技术哲学视角。',
  '{
    "chapters": [
      {
        "title": "1. 技术的定义",
        "sections": ["实现目的的手段", "实践和元器件的集成", "文化中利用的装置和工程实践的集合"],
        "key_points": ["技术是实现人类目的的手段", "技术由实践方法和具体装置组成", "技术是特定文化背景下的产物"]
      },
      {
        "title": "2. 技术的进化",
        "sections": ["组合原理", "结构与逻辑", "递归性结构", "模块化"],
        "key_points": ["所有技术都是现有技术的组合", "技术组件本身也是技术", "利用或开发自然现象", "技术依赖现象实现"]
      },
      {
        "title": "3. 技术与科学",
        "sections": ["科学是技术的副产品", "技术推动科学进步", "技术提供观象实例", "具体例子"],
        "key_points": ["最基本结构：主集成+支撑集成", "递归性结构：包含技术的技术", "技术依赖现象", "现象应用"]
      }
    ],
    "key_concepts": ["组合原理", "递归结构", "模块化", "技术依赖现象", "科学技术关系"],
    "main_themes": ["技术本质探讨", "技术演进规律", "技术与科学互动", "技术哲学思考"]
  }'::jsonb,
  '{
    "chapters": [
      {
        "title": "1. 技术的定义",
        "sections": ["实现目的的手段", "实践和元器件的集成", "文化中利用的装置和工程实践的集合"],
        "key_points": ["技术是实现人类目的的手段", "技术由实践方法和具体装置组成", "技术是特定文化背景下的产物"]
      },
      {
        "title": "2. 技术的进化",
        "sections": ["组合原理", "结构与逻辑", "递归性结构", "模块化"],
        "key_points": ["所有技术都是现有技术的组合", "技术组件本身也是技术", "利用或开发自然现象", "技术依赖现象实现"]
      },
      {
        "title": "3. 技术与科学",
        "sections": ["科学是技术的副产品", "技术推动科学进步", "技术提供观象实例", "具体例子"],
        "key_points": ["最基本结构：主集成+支撑集成", "递归性结构：包含技术的技术", "技术依赖现象", "现象应用"]
      }
    ],
    "key_concepts": ["组合原理", "递归结构", "模块化", "技术依赖现象", "科学技术关系"],
    "main_themes": ["技术本质探讨", "技术演进规律", "技术与科学互动", "技术哲学思考"]
  }'::jsonb,
  'sample_' || md5(random()::text) -- ⚠️ This generates a unique hash automatically
) ON CONFLICT (book_id, content_hash) DO UPDATE SET
  summary = EXCLUDED.summary,
  content_analysis = EXCLUDED.content_analysis,
  mind_map_data = EXCLUDED.mind_map_data,
  updated_at = now();

-- Verify it worked (replace 63 with your book_id):
-- SELECT id, book_id, summary, created_at FROM ai_book_analysis WHERE book_id = 63;
