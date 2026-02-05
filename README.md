
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
  
  - `POST /api/analyze`（mock，前端生产环境会优先走它）
  - `POST /api/generate`（mock，前端生产环境会优先走它）
  - `POST /api/runninghub/ping`（检查 RunningHub 相关变量是否配置正确）
  - `POST /api/runninghub/run`（调用 RunningHub 提交工作流任务）
  - `POST /api/runninghub/query`（调用 RunningHub 查询任务结果）
  
  其中 RunningHub 相关接口**需要你在 Cloudflare Pages 环境变量里配置密钥/工作流**，否则会返回 `missing-env` 错误。
  
  ### 3) 环境变量（建议在 Cloudflare 中配置）
  
  你可以在 Cloudflare Pages → Settings → Environment variables 添加需要的密钥与配置；建议使用：
  
  - `OPENAI_API_KEY`（或你自己的模型服务密钥）
  - `AI_API_URL`（如果你要转发到自建后端）
  - `RUNNINGHUB_API_KEY`
  - `RUNNINGHUB_WORKFLOW_ID`（你的模型渲染工作流 ID）
  - `RUNNINGHUB_WORKFLOW_RUN_URL`（可选，默认 https://api.runninghub.cn/run/workflow/${RUNNINGHUB_WORKFLOW_ID}；不要填成 `https://www.runninghub.cn/upload/image` 这类上传接口）

  - `RUNNINGHUB_IMAGE_NODE_ID` / `RUNNINGHUB_IMAGE_PARAM_KEY`（可选：当前端未提供 nodeInfoList 时，用于把 imageDataUrl 映射到工作流节点；默认 1/image）
  - `RUNNINGHUB_DEFAULT_PROMPT` / `RUNNINGHUB_PROMPT_NODE_ID` / `RUNNINGHUB_PROMPT_PARAM_KEY`（可选：某些工作流需要 prompt 节点，可用环境变量补齐；默认 4/prompt）

  - `RUNNINGHUB_QUERY_URL`（可选，查询接口地址）

  
  前端会优先调用同域 `/api/*`；其中 `analyze/generate` 在生产环境会优先走 Functions，开发环境默认走前端 mock；模型渲染相关功能会走 `runninghub/*`。

  ### 4) 本地开发（推荐 wrangler 模拟线上）

  - 复制一份变量文件：把 `.dev.vars.example` 复制成 `.dev.vars`，填上你的 `RUNNINGHUB_API_KEY` 与 `RUNNINGHUB_WORKFLOW_ID`（以及可选项）。
  - 启动：本地需要同时跑前端与 Pages Functions
    - 终端 A：运行 `npm run dev`（Vite，默认 `http://127.0.0.1:5173`）
    - 终端 B：运行 `npm run dev:cf`（Wrangler Pages，`http://127.0.0.1:8788`，并代理到 5173）
    - 建议用浏览器打开 `http://127.0.0.1:8788`，体验与线上一致（同域 `/api/*`）。

  说明：`.dev.vars` 已在 `.gitignore` 中忽略；线上部署时 Cloudflare 会自动使用你在 Dashboard 配置的环境变量。


  
