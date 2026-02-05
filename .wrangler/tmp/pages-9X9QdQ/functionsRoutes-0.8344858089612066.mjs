import { onRequestPost as __api_runninghub_ping_ts_onRequestPost } from "D:\\我的应用\\模型渲染AI\\functions\\api\\runninghub\\ping.ts"
import { onRequestPost as __api_runninghub_query_ts_onRequestPost } from "D:\\我的应用\\模型渲染AI\\functions\\api\\runninghub\\query.ts"
import { onRequestPost as __api_runninghub_run_ts_onRequestPost } from "D:\\我的应用\\模型渲染AI\\functions\\api\\runninghub\\run.ts"
import { onRequestPost as __api_analyze_ts_onRequestPost } from "D:\\我的应用\\模型渲染AI\\functions\\api\\analyze.ts"
import { onRequestPost as __api_generate_ts_onRequestPost } from "D:\\我的应用\\模型渲染AI\\functions\\api\\generate.ts"

export const routes = [
    {
      routePath: "/api/runninghub/ping",
      mountPath: "/api/runninghub",
      method: "POST",
      middlewares: [],
      modules: [__api_runninghub_ping_ts_onRequestPost],
    },
  {
      routePath: "/api/runninghub/query",
      mountPath: "/api/runninghub",
      method: "POST",
      middlewares: [],
      modules: [__api_runninghub_query_ts_onRequestPost],
    },
  {
      routePath: "/api/runninghub/run",
      mountPath: "/api/runninghub",
      method: "POST",
      middlewares: [],
      modules: [__api_runninghub_run_ts_onRequestPost],
    },
  {
      routePath: "/api/analyze",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_analyze_ts_onRequestPost],
    },
  {
      routePath: "/api/generate",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_generate_ts_onRequestPost],
    },
  ]