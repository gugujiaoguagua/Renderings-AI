var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-ldsDrP/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// .wrangler/tmp/pages-pAHqgQ/functionsWorker-0.059983459081505375.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function stripCfConnectingIPHeader2(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
__name2(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader2.apply(null, argArray)
    ]);
  }
});
function json(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers ?? {}
    },
    ...init
  });
}
__name(json, "json");
__name2(json, "json");
function pickEnvValue(env, key) {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
__name(pickEnvValue, "pickEnvValue");
__name2(pickEnvValue, "pickEnvValue");
function normalizeWorkflowType(value) {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : null;
}
__name(normalizeWorkflowType, "normalizeWorkflowType");
__name2(normalizeWorkflowType, "normalizeWorkflowType");
var onRequestPost = /* @__PURE__ */ __name2(async ({ request, env }) => {
  const bodyText = await request.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  const workflowType = normalizeWorkflowType(body?.workflowType);
  const suffix = workflowType ? `_${workflowType}` : "";
  const workflowIdKeyUsed = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_ID${suffix}`) ? `RUNNINGHUB_WORKFLOW_ID${suffix}` : pickEnvValue(env, "RUNNINGHUB_WORKFLOW_ID") ? "RUNNINGHUB_WORKFLOW_ID" : null;
  const runUrlKeyUsed = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`) ? `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}` : pickEnvValue(env, "RUNNINGHUB_WORKFLOW_RUN_URL") ? "RUNNINGHUB_WORKFLOW_RUN_URL" : null;
  const queryUrlKeyUsed = pickEnvValue(env, "RUNNINGHUB_QUERY_URL") ? "RUNNINGHUB_QUERY_URL" : null;
  const workflowId = workflowIdKeyUsed ? pickEnvValue(env, workflowIdKeyUsed) : null;
  const runUrlOverride = runUrlKeyUsed ? pickEnvValue(env, runUrlKeyUsed) : null;
  const runUrl = runUrlOverride ?? (workflowId ? `https://www.runninghub.cn/openapi/v2/run/workflow/${workflowId}` : null);
  let runUrlHost = null;
  let runUrlPath = null;
  if (runUrl) {
    try {
      const u = new URL(runUrl);
      runUrlHost = u.host;
      runUrlPath = u.pathname;
    } catch {
      runUrlHost = null;
      runUrlPath = null;
    }
  }
  const ok = Boolean(pickEnvValue(env, "RUNNINGHUB_API_KEY")) && Boolean(runUrlHost);
  return json({
    ok,
    workflowType,
    workflowIdKeyUsed,
    runUrlKeyUsed,
    queryUrlKeyUsed,
    runUrlHost,
    runUrlPath
  });
}, "onRequestPost");
function json2(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers ?? {}
    },
    ...init
  });
}
__name(json2, "json2");
__name2(json2, "json");
function pickEnvValue2(env, key) {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
__name(pickEnvValue2, "pickEnvValue2");
__name2(pickEnvValue2, "pickEnvValue");
var onRequestPost2 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  const apiKey = pickEnvValue2(env, "RUNNINGHUB_API_KEY");
  const queryUrl = pickEnvValue2(env, "RUNNINGHUB_QUERY_URL") ?? "https://www.runninghub.cn/openapi/v2/query";
  if (!apiKey)
    return json2({ error: "missing-env", key: "RUNNINGHUB_API_KEY" }, { status: 500 });
  const bodyText = await request.text();
  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = null;
  }
  const taskId = payload?.taskId;
  if (!taskId || typeof taskId !== "string")
    return json2({ error: "missing-taskId" }, { status: 400 });
  const resp = await fetch(queryUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ taskId })
  });
  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!resp.ok) {
    return json2(
      {
        error: "runninghub-error",
        status: resp.status,
        body: data ?? text
      },
      { status: 502 }
    );
  }
  if (!data) {
    return json2({ error: "runninghub-invalid-json", body: text }, { status: 502 });
  }
  if (data?.errorCode || data?.errorMessage) {
    return json2({ error: "runninghub-response-error", body: data }, { status: 502 });
  }
  if (!data.taskId || !data.status) {
    return json2({ error: "runninghub-invalid-response", body: data }, { status: 502 });
  }
  return json2(data);
}, "onRequestPost");
function json3(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers ?? {}
    },
    ...init
  });
}
__name(json3, "json3");
__name2(json3, "json");
function pickEnvValue3(env, key) {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
__name(pickEnvValue3, "pickEnvValue3");
__name2(pickEnvValue3, "pickEnvValue");
function normalizeWorkflowType2(value) {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : null;
}
__name(normalizeWorkflowType2, "normalizeWorkflowType2");
__name2(normalizeWorkflowType2, "normalizeWorkflowType");
var onRequestPost3 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  const apiKey = pickEnvValue3(env, "RUNNINGHUB_API_KEY");
  const rawBody = await request.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(rawBody);
  } catch {
    bodyJson = null;
  }
  const workflowType = normalizeWorkflowType2(bodyJson?.workflowType);
  const suffix = workflowType ? `_${workflowType}` : "";
  const workflowId = pickEnvValue3(env, `RUNNINGHUB_WORKFLOW_ID${suffix}`) ?? pickEnvValue3(env, "RUNNINGHUB_WORKFLOW_ID");
  const runUrlOverride = pickEnvValue3(env, `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`) ?? pickEnvValue3(env, "RUNNINGHUB_WORKFLOW_RUN_URL");
  if (!apiKey)
    return json3({ error: "missing-env", key: "RUNNINGHUB_API_KEY" }, { status: 500 });
  if (!runUrlOverride && !workflowId) {
    return json3({ error: "missing-env", key: "RUNNINGHUB_WORKFLOW_ID" }, { status: 500 });
  }
  const runUrl = runUrlOverride ?? `https://www.runninghub.cn/openapi/v2/run/workflow/${workflowId}`;
  const resp = await fetch(runUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: rawBody
  });
  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!resp.ok) {
    return json3(
      {
        error: "runninghub-error",
        status: resp.status,
        body: data ?? text
      },
      { status: 502 }
    );
  }
  if (!data) {
    return json3({ error: "runninghub-invalid-json", body: text }, { status: 502 });
  }
  if (data?.errorCode || data?.errorMessage) {
    return json3({ error: "runninghub-response-error", body: data }, { status: 502 });
  }
  if (!data.taskId || !data.status) {
    return json3({ error: "runninghub-invalid-response", body: data }, { status: 502 });
  }
  return json3(data);
}, "onRequestPost");
var mockAnalyses = [
  {
    summary: "\u5BA4\u5185\u4EBA\u50CF\u3001\u67D4\u5149\u3001\u6D45\u666F\u6DF1",
    details: "\u8FD9\u662F\u4E00\u5F20\u4E13\u4E1A\u7684\u4EBA\u50CF\u6444\u5F71\u4F5C\u54C1\uFF0C\u91C7\u7528\u81EA\u7136\u5149\u62CD\u6444\uFF0C\u80CC\u666F\u865A\u5316\u6548\u679C\u826F\u597D\u3002\u4EBA\u7269\u8868\u60C5\u81EA\u7136\uFF0C\u5149\u7EBF\u67D4\u548C\uFF0C\u6574\u4F53\u8272\u8C03\u6E29\u6696\u3002\u9002\u5408\u7528\u4E8E\u5934\u50CF\u3001\u793E\u4EA4\u5A92\u4F53\u6216\u4E13\u4E1A\u7B80\u5386\u3002",
    tags: ["\u4EBA\u50CF", "\u5BA4\u5185", "\u81EA\u7136\u5149", "\u4E13\u4E1A"],
    confidence: 0.92
  },
  {
    summary: "\u98CE\u666F\u6444\u5F71\u3001\u65E5\u843D\u65F6\u5206\u3001\u5C71\u666F",
    details: "\u58EE\u4E3D\u7684\u5C71\u5730\u98CE\u5149\uFF0C\u62CD\u6444\u4E8E\u65E5\u843D\u65F6\u5206\u3002\u753B\u9762\u5C42\u6B21\u5206\u660E\uFF0C\u8272\u5F69\u9971\u6EE1\uFF0C\u5C55\u73B0\u4E86\u5927\u81EA\u7136\u7684\u78C5\u7934\u6C14\u52BF\u3002\u5149\u7EBF\u6E29\u6696\uFF0C\u9002\u5408\u4F5C\u4E3A\u58C1\u7EB8\u6216\u65C5\u884C\u8BB0\u5F55\u3002",
    tags: ["\u98CE\u666F", "\u5C71\u666F", "\u65E5\u843D", "\u6237\u5916"],
    confidence: 0.89
  },
  {
    summary: "\u5BA0\u7269\u6444\u5F71\u3001\u52A8\u7269\u7279\u5199\u3001\u81EA\u7136\u73AF\u5883",
    details: "\u53EF\u7231\u7684\u5BA0\u7269\u7167\u7247\uFF0C\u6355\u6349\u5230\u4E86\u52A8\u7269\u751F\u52A8\u7684\u8868\u60C5\u548C\u59FF\u6001\u3002\u80CC\u666F\u7B80\u6D01\uFF0C\u4E3B\u4F53\u7A81\u51FA\uFF0C\u8272\u5F69\u81EA\u7136\u3002\u975E\u5E38\u9002\u5408\u5BA0\u7269\u4E3B\u4EBA\u7EAA\u5FF5\u6216\u5206\u4EAB\u3002",
    tags: ["\u5BA0\u7269", "\u52A8\u7269", "\u7279\u5199", "\u6237\u5916"],
    confidence: 0.95
  },
  {
    summary: "\u4EA7\u54C1\u6444\u5F71\u3001\u7B80\u7EA6\u98CE\u683C\u3001\u9759\u7269",
    details: "\u4E13\u4E1A\u7684\u4EA7\u54C1\u6444\u5F71\uFF0C\u91C7\u7528\u7B80\u7EA6\u7684\u6784\u56FE\u548C\u7EAF\u51C0\u7684\u80CC\u666F\u3002\u5149\u7EBF\u5747\u5300\uFF0C\u7EC6\u8282\u6E05\u6670\uFF0C\u80FD\u591F\u5F88\u597D\u5730\u5C55\u73B0\u4EA7\u54C1\u7684\u8D28\u611F\u548C\u8BBE\u8BA1\u3002\u9002\u5408\u7535\u5546\u6216\u54C1\u724C\u5C55\u793A\u3002",
    tags: ["\u4EA7\u54C1", "\u9759\u7269", "\u7B80\u7EA6", "\u5546\u4E1A"],
    confidence: 0.88
  },
  {
    summary: "\u62BD\u8C61\u827A\u672F\u3001\u8272\u5F69\u4E30\u5BCC\u3001\u521B\u610F\u8BBE\u8BA1",
    details: "\u5145\u6EE1\u521B\u610F\u7684\u62BD\u8C61\u4F5C\u54C1\uFF0C\u8272\u5F69\u9C9C\u660E\uFF0C\u6784\u56FE\u72EC\u7279\u3002\u89C6\u89C9\u51B2\u51FB\u529B\u5F3A\uFF0C\u5BCC\u6709\u827A\u672F\u611F\u548C\u60F3\u8C61\u7A7A\u95F4\u3002\u9002\u5408\u4F5C\u4E3A\u88C5\u9970\u753B\u6216\u8BBE\u8BA1\u7D20\u6750\u3002",
    tags: ["\u62BD\u8C61", "\u827A\u672F", "\u8272\u5F69", "\u521B\u610F"],
    confidence: 0.86
  }
];
function json4(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers ?? {}
    },
    ...init
  });
}
__name(json4, "json4");
__name2(json4, "json");
var onRequestPost4 = /* @__PURE__ */ __name2(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
    return json4({ error: "missing-image" }, { status: 400 });
  }
  const idx = Math.floor(Math.random() * mockAnalyses.length);
  return json4({ analysis: mockAnalyses[idx] });
}, "onRequestPost");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
__name2(sleep, "sleep");
function json5(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers ?? {}
    },
    ...init
  });
}
__name(json5, "json5");
__name2(json5, "json");
var onRequestPost5 = /* @__PURE__ */ __name2(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
    return json5({ error: "missing-image" }, { status: 400 });
  }
  for (let i = 0; i < 10; i += 1) {
    await sleep(200 + Math.random() * 300);
  }
  return json5({
    generatedUrl: body.imageDataUrl
  });
}, "onRequestPost");
var routes = [
  {
    routePath: "/api/runninghub/ping",
    mountPath: "/api/runninghub",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/runninghub/query",
    mountPath: "/api/runninghub",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/runninghub/run",
    mountPath: "/api/runninghub",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/analyze",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/generate",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = /* @__PURE__ */ __name(class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
}, "__Facade_ScheduledController__");
__name2(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-ldsDrP/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-ldsDrP/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__2, "__Facade_ScheduledController__");
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.059983459081505375.js.map
