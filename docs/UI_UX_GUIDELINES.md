# Auckland Weekend Planner - UI/UX Guidelines

## 1. 多巴胺调色盘 (Dopamine Palette) & Glassmorphism
- 摒弃传统单调的后台式风格，拥抱高饱和度、令人愉悦的“多巴胺”色彩搭配（如：明黄、薄荷绿、珊瑚粉的渐变与点缀）。
- 主要背景或卡片使用 **Glassmorphism（毛玻璃/磨砂玻璃）** 效果，结合背景的动态渐变（Mesh Gradient），营造现代、透气的高级感。

## 2. 现代布局：Neo-Bento Grid (新便当盒布局)
- 首屏与核心模块采用类似于 Apple 官网设计的 **Bento Grid（便当盒）** 结构。
- 每个模块（如：今日天气卡片、热门活动图块、AI 对话气泡）都是一个独立、圆角分明、大小错落有致的盒子，既井然有序又充满视觉张力。

## 3. 极致微交互：The "Jelly" Micro-interactions (Framer Motion)
- 引入 **Framer Motion** 处理所有动画逻辑。
- 强调“果冻感（Jelly）”和“物理惯性（Spring physics）”的微交互。
  - 按钮悬浮时不是生硬的变色，而是带有弹性（Spring）的缩放与光晕扩散。
  - 页面切换、卡片加载采用级联（Staggered）式的滑入动画。
- 即便是数据 Loading 状态，也要采用生动的骨架屏（Skeleton）+ 微光扫过（Shimmer）动画。

## 4. Next-Gen Map 体验 (Mapbox / MapLibre)
- 由于地理位置对于周末规划至关重要，引入 **Mapbox** 或 **MapLibre GL JS** 替换普通地图。
- 实现 3D 视角、自定义酷炫底图（如暗色霓虹风格），并在地图上通过自定义的、带有呼吸动画的 Marker 展示活动地点。

## 5. 情绪与氛围指标：Vibe-O-Meter
- 为每个活动或整个周末推荐创建一个创新的UI组件：**Vibe-O-Meter（氛围仪表盘）**。
- 以极其直观的可视化形式（如雷达图或动态进度条），展示当前推荐的“Chill指数”、“活力指数”、“烧钱指数”等，让用户一眼抓取核心特征。