# ACE-Step 接口字段

## 协议身份

- 插件 ID：`ace-step-audio`。
- Provider ID：`ace-step-audio`。
- 能力：`audio`。
- 默认 Base URL：`http://127.0.0.1:8001`。
- 鉴权驱动：`none`（本地服务未启用鉴权时无需真实密钥）。
- 创建：`POST /release_task`。
- 查询：`POST /query_result`。

## 前置要求

- 本机已部署 ACE-Step 1.5 API 服务并监听 `127.0.0.1:8001`（可用 `start_api_server_macos.sh` 启动）。
- 服务端已完成模型下载（DiT 模型与 5Hz LM）。插件默认按服务端加载的模型生成。
- 服务需应用过 `query_result` 顶层 `audio_paths` 补丁（成功响应直接携带绝对音频下载地址），否则 BeefTV 无法从内嵌 `result` 字符串中提取音频地址。
- BeefTV 后端出站访问 `127.0.0.1` 需在 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS` 中放行该主机。

## 配置字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | API Key；服务未启用 `--api-key` 时填写任意占位值即可 |

## 统一字段映射

| 统一字段 | 类型 | 必填 | 上游映射 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | `model` | DiT 模型名，如 `acestep-v15-turbo`。 |
| `prompt` | string | 是 | `prompt` | 音乐风格描述。 |
| `providerOptions` | object | 否 | `provider-specific fields` | 插件命名空间内的扩展字段。 |

## Provider 扩展键

- `providerOptions.ace-step-audio.lyrics`：歌词文本；留空表示纯音乐。
- `providerOptions.ace-step-audio.thinking`：是否启用 5Hz LM 规划（默认 `true`）。
- `providerOptions.ace-step-audio.duration`：音频时长（秒，10–600，默认 60）。
- `providerOptions.ace-step-audio.batchSize`：一次生成的歌曲数（默认 1）。
- `providerOptions.ace-step-audio.audioFormat`：输出格式（默认 `mp3`）。

## 上游请求模板逐字段清单

| 上游位置 | 值或转换表达式 |
| --- | --- |
| `create.method` | `"POST"` |
| `create.path` | `"/release_task"`（`originPath: true`，绝对路径直连，不自动追加版本前缀） |
| `create.contentType` | `"application/json"` |
| `create.body.prompt` | `{"$ref":"request.prompt"}` |
| `create.body.lyrics` | `{"$coalesce":[{"$ref":"request.providerOptions.ace-step-audio.lyrics"},""]}` |
| `create.body.thinking` | `{"$coalesce":[{"$ref":"request.providerOptions.ace-step-audio.thinking"},true]}` |
| `create.body.audio_duration` | `{"$coalesce":[{"$toFloat":{"$ref":"request.providerOptions.ace-step-audio.duration"}},60]}` |
| `create.body.audio_format` | `{"$coalesce":[{"$ref":"request.extra.audioFormat"},{"$ref":"request.providerOptions.ace-step-audio.audioFormat"},"mp3"]}` |
| `create.body.model` | `{"$omitEmpty":{"$ref":"request.model"}}` |
| `create.body.batch_size` | `{"$if":{"condition":{"$gt":[{"$toInt":{"$ref":"request.providerOptions.ace-step-audio.batchSize"}},0]},"then":{"$toInt":{"$ref":"request.providerOptions.ace-step-audio.batchSize"}},"else":1}}`（避免 `$toInt(nil)=0` 被 ACE-Step 当作生成 0 首） |
| `poll.method` | `"POST"` |
| `poll.path` | `"/query_result"`（`originPath: true`） |
| `poll.contentType` | `"application/json"` |
| `poll.body.task_id_list` | `[{"$ref":"taskId"}]` |

## 响应映射逐字段清单

| 映射位置 | 上游路径或转换表达式 |
| --- | --- |
| `response.taskId` | `{"$coalesce":[{"$ref":"response.data.task_id"},{"$ref":"response.data.0.task_id"}]}` |
| `response.status` | 数字状态码映射：`2→failed`，`1→succeeded`，其余 `pending` |
| `response.message` | `{"$coalesce":[{"$ref":"response.error"},{"$ref":"response.data.0.progress_text"}]}` |
| `response.audios` | `{"$coalesce":[{"$ref":"response.data.0.audio_paths"},{"$ref":"response.data.0.first_audio_path"}]}` |
| `response.errorPaths[0]` | `"error"` |
| `response.resultEphemeral` | `true` |

## 响应与错误

- 上游任务状态为数字：`0` 进行中、`1` 成功、`2` 失败；宿主按映射词归一。
- 成功时音频地址来自顶层 `audio_paths`（绝对 URL，宿主立即下载持久化）。
- 队列繁忙时上游返回 HTTP 429，保持失败语义，不包装成成功。

## 兼容边界

- 仅支持文本生成音乐（`text2music`）；翻唱、重绘等参考音频任务暂未接入。
- 歌词经 `providerOptions` 单字段传入，不做 prompt 拆分。

<!-- BEEFTV_PLUGIN_MANIFEST_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "beeftv.plugin/v2",
  "id": "ace-step-audio",
  "name": "ACE-Step",
  "version": "1.0.0",
  "author": "BeefTV Contributors",
  "description": "ACE-Step 本地音乐生成服务协议插件。",
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "API Key（服务未启用鉴权时填写任意占位值）",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "ace-step-audio",
        "label": "ACE-Step",
        "capabilities": [
          "audio"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "http://127.0.0.1:8001",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "none",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model",
            "description": "DiT 模型名（如 acestep-v15-turbo）；与服务端加载的模型保持一致。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "音乐风格描述。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "插件命名空间内的扩展字段：lyrics、thinking、duration、batchSize。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/release_task",
          "originPath": true,
          "contentType": "application/json",
          "body": {
            "prompt": {
              "$ref": "request.prompt"
            },
            "lyrics": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.ace-step-audio.lyrics"
                },
                ""
              ]
            },
            "thinking": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.ace-step-audio.thinking"
                },
                true
              ]
            },
            "audio_duration": {
              "$coalesce": [
                {
                  "$toFloat": {
                    "$ref": "request.providerOptions.ace-step-audio.duration"
                  }
                },
                60
              ]
            },
            "audio_format": {
              "$coalesce": [
                {
                  "$ref": "request.extra.audioFormat"
                },
                {
                  "$ref": "request.providerOptions.ace-step-audio.audioFormat"
                },
                "mp3"
              ]
            },
            "model": {
              "$omitEmpty": {
                "$ref": "request.model"
              }
            },
            "batch_size": {
              "$if": {
                "condition": {
                  "$gt": [
                    {
                      "$toInt": {
                        "$ref": "request.providerOptions.ace-step-audio.batchSize"
                      }
                    },
                    0
                  ]
                },
                "then": {
                  "$toInt": {
                    "$ref": "request.providerOptions.ace-step-audio.batchSize"
                  }
                },
                "else": 1
              }
            }
          }
        },
        "poll": {
          "method": "POST",
          "path": "/query_result",
          "originPath": true,
          "contentType": "application/json",
          "body": {
            "task_id_list": [
              {
                "$ref": "taskId"
              }
            ]
          }
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.data.task_id"
              },
              {
                "$ref": "response.data.0.task_id"
              }
            ]
          },
          "status": {
            "$if": {
              "condition": {
                "$eq": [
                  {
                    "$toFloat": {
                      "$ref": "response.data.0.status"
                    }
                  },
                  2
                ]
              },
              "then": "failed",
              "else": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$toFloat": {
                          "$ref": "response.data.0.status"
                        }
                      },
                      1
                    ]
                  },
                  "then": "succeeded",
                  "else": "pending"
                }
              }
            }
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.error"
              },
              {
                "$ref": "response.data.0.progress_text"
              }
            ]
          },
          "audios": {
            "$coalesce": [
              {
                "$ref": "response.data.0.audio_paths"
              },
              {
                "$ref": "response.data.0.first_audio_path"
              }
            ]
          },
          "errorPaths": [
            "error"
          ],
          "resultEphemeral": true
        }
      }
    ]
  }
}
```
<!-- BEEFTV_PLUGIN_MANIFEST_END -->
