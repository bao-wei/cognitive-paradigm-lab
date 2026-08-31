window.IMPORTED_PARADIGMS = [
  {
    "id": "change-detection",
    "name": "变化检测与变化定位任务",
    "shortDescription": "通过变化检测与变化定位任务测量视觉工作记忆表现，比较相同与变化条件下的正确率和反应时。",
    "category": "工作记忆",
    "taskType": "变化检测与定位",
    "duration": "约 10 分钟",
    "metrics": [
      "正确率",
      "平均反应时",
      "条件差异"
    ],
    "tags": [],
    "platform": "PsychoJS",
    "entry": "./paradigms/packages/change-detection/index.html",
    "descriptionPath": "./paradigms/packages/change-detection/description.md",
    "status": "ready",
    "dataExport": "adapter",
    "result": {
      "profile": "difference",
      "fields": {
        "correct": "key_resp.corr",
        "rt": "key_resp.rt",
        "condition": "condition_label",
        "pumps": "nPumps",
        "popped": "popped",
        "earnings": "earnings"
      },
      "levels": [
        "same",
        "change"
      ]
    },
    "license": "来源仓库未声明；发布前请核对授权",
    "source": "https://gitlab.pavlovia.org/demos/change_detection",
    "issues": []
  },
  {
    "id": "bart",
    "name": "BART 气球模拟风险任务",
    "shortDescription": "在继续充气以获得更多收益与避免气球爆炸之间权衡，体验风险决策。",
    "category": "决策与奖赏",
    "taskType": "连续风险决策",
    "duration": "约 5 分钟",
    "metrics": [
      "调整后平均充气次数",
      "气球爆炸比例",
      "累计收益"
    ],
    "tags": [
      "风险决策",
      "奖赏",
      "冲动性",
      "PsychoJS"
    ],
    "platform": "PsychoJS",
    "entry": "./paradigms/packages/bart/index.html",
    "descriptionPath": "./paradigms/packages/bart/description.md",
    "status": "ready",
    "dataExport": "adapter",
    "result": {
      "profile": "bart",
      "fields": {
        "correct": "",
        "rt": "",
        "condition": "",
        "pumps": "nPumps",
        "popped": "popped",
        "earnings": "earnings"
      },
      "levels": []
    },
    "license": "来源与第三方许可见 THIRD_PARTY_NOTICES.md",
    "source": "https://gitlab.pavlovia.org/demos/bart",
    "issues": []
  }
];
