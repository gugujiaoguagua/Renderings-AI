
  # Renderings-AI

  This is a code bundle for Image Selection and Generation. The original project is available at https://www.figma.com/design/jO3MUh6t8FIoszo9PCX2th/Image-Selection-and-Generation.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
  ## Cloudflare Pages 部署（推荐）
  
  这是一个 Vite 前端项目，可直接部署到 Cloudflare Pages；同时仓库内已包含 Pages Functions（`/functions`），用于同域 `/api/*` 无服务器接口，后续你可以在 Cloudflare 环境变量里配置密钥并替换接口实现。
  
  ### 1) Pages 构建配置
  
  - Framework preset：Vite
  - Build command：`npm run build`
  - Build output directory：`dist`
  - Root directory：仓库根目录
  
  ### 2) Pages Functions（无服务器接口）
  
  - `POST /api/analyze`
  - `POST /api/generate`
  - `POST /api/runninghub/run`
  - `POST /api/runninghub/query`
  
  当前默认实现是 mock（不会用到任何密钥），部署后应用即可直接访问。
  
  ### 3) 环境变量（后续可在 Cloudflare 中配置）
  
  你可以在 Cloudflare Pages → Settings → Environment variables 添加需要的密钥与配置；建议使用：
  
  - `OPENAI_API_KEY`（或你自己的模型服务密钥）
  - `AI_API_URL`（如果你要转发到自建后端）
  - `RUNNINGHUB_API_KEY`
  - `RUNNINGHUB_WORKFLOW_ID`（你的模型渲染工作流 ID）
  - `RUNNINGHUB_WORKFLOW_RUN_URL`（可选，默认按 ID 拼接）
  - `RUNNINGHUB_QUERY_URL`（可选，默认 https://www.runninghub.cn/openapi/v2/query）
  
  前端会优先调用同域 `/api/*`；若接口不可用会自动回退到本地 mock。
  
