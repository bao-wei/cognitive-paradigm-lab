(function registerImageryTasks(T) {
  "use strict";

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const valid = (rows) => rows.filter((row) => row.valid !== false);
  const correctRT = (c, rows) => c.mean(valid(rows).filter((row) => row.correct === true && Number.isFinite(row.rt)).map((row) => row.rt));
  const rtText = (value) => value === null ? "数据不足" : `${Math.round(value)} ms`;
  const accuracy = (c, rows) => c.percent(valid(rows).filter((row) => row.correct === true).length, valid(rows).length);
  const diffText = (first, second) => first === null || second === null ? "数据不足" : `${first - second >= 0 ? "+" : ""}${Math.round(first - second)} ms`;
  const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${escape(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  // Each original drawing uses a common 160 × 160 coordinate frame. The task varies that entire frame, not the labels.
  const objects = {
    lamp: { name: "台灯", svg: '<path d="M54 23H105L121 74H38Z" fill="#d9cba8"/><path d="M79 74V124M57 135H102M68 124H91" fill="none" stroke-width="9"/><path d="M78 135Q49 153 24 139" fill="none" stroke-width="3"/>' },
    zebra: { name: "斑马", svg: '<path d="M25 74Q40 49 98 58L113 27L136 37L127 65L114 82L103 103H42L33 133H22L28 97Z" fill="#f7f4e9"/><path d="M45 102L47 137H58L61 102M90 103L95 137H107L105 98" fill="#f7f4e9"/><path d="M32 62L43 98M48 58L56 101M66 57L74 101M84 59L92 101M110 38L127 47M105 53L121 61M117 28L127 23L128 35M26 78Q8 76 11 104" fill="none" stroke-width="6"/><circle cx="129" cy="42" r="2" fill="#172839"/>' },
    cup: { name: "杯子", svg: '<path d="M39 36H108L101 132H48Z" fill="#d9e1df"/><path d="M109 54Q146 48 139 91Q136 112 105 110" fill="none" stroke-width="10"/><path d="M38 36Q74 26 109 36M45 125Q76 134 101 125" fill="none" stroke-width="3"/>' },
    elephant: { name: "大象", svg: '<path d="M17 68Q19 35 73 42Q100 21 124 48Q137 62 138 94L141 129Q132 151 116 133L120 93L109 92L104 136H88L84 103H52L48 137H31L28 102Q13 91 17 68Z" fill="#aebfc3"/><ellipse cx="96" cy="66" rx="24" ry="31" fill="#c4d1d2"/><path d="M18 65Q5 68 10 95" fill="none" stroke-width="4"/><circle cx="124" cy="63" r="3" fill="#172839"/><path d="M119 87Q103 103 105 84" fill="#fffdf7"/>' },
    bus: { name: "公共汽车", svg: '<rect x="10" y="39" width="140" height="81" rx="12" fill="#d8ad55"/><path d="M17 51H119V82H17Z" fill="#dce5e2"/><path d="M39 51V82M64 51V82M90 51V82M124 50H143V112H124Z" fill="none" stroke-width="4"/><circle cx="39" cy="122" r="15" fill="#172839"/><circle cx="122" cy="122" r="15" fill="#172839"/><circle cx="39" cy="122" r="7" fill="#dce5e2"/><circle cx="122" cy="122" r="7" fill="#dce5e2"/>' },
    chair: { name: "椅子", svg: '<path d="M38 23H117V87H38Z" fill="#b67f50"/><path d="M32 89H124V107H32Z" fill="#cc9a65"/><path d="M39 106L35 143M115 106L120 143M43 37H110M45 56H109M46 75H109" fill="none" stroke-width="6"/>' },
    tree: { name: "大树", svg: '<path d="M66 82H94L102 146H57Z" fill="#a77750"/><path d="M24 79Q7 49 37 39Q34 12 67 17Q91 -3 112 25Q145 22 141 52Q164 79 134 99Q114 119 91 105Q63 127 42 106Q12 107 24 79Z" fill="#709879"/><path d="M81 100V143M82 119L65 103M82 114L100 94" fill="none" stroke-width="5"/>' },
    key: { name: "钥匙", svg: '<path d="M63 66L129 132L143 118L132 106L124 114L112 102L121 93L107 79L98 88L79 68" fill="#d0a65b" stroke-width="5"/><circle cx="48" cy="47" r="32" fill="#d0a65b" stroke-width="5"/><circle cx="48" cy="47" r="13" fill="#fffdf7" stroke-width="4"/>' },
    house: { name: "房屋", svg: '<path d="M27 69H134V142H27Z" fill="#dbcfb5"/><path d="M13 70L79 15L148 70Z" fill="#b76752"/><path d="M64 95H95V142H64Z" fill="#98714f"/><path d="M40 85H56V108H40ZM108 85H124V108H108Z" fill="#e6eee7"/><path d="M119 37V18H132V48" fill="#dbcfb5"/>' },
    book: { name: "书本", svg: '<path d="M23 25L126 17L142 132L36 144Z" fill="#b76654"/><path d="M36 128L140 116L142 132L36 144Q15 142 18 128L23 25" fill="#f4e8d0"/><path d="M36 144L23 25M48 47L111 42M51 60L105 55" fill="none" stroke-width="4"/>' },
    giraffe: { name: "长颈鹿", svg: '<path d="M28 82Q48 65 82 78L98 26L116 14L140 27L131 44L115 39L110 97L102 105L109 144H96L85 109H54L48 144H35L38 101L24 101Z" fill="#d8b25d"/><path d="M112 19L111 6M124 20L128 8M29 83Q13 84 16 111" fill="none" stroke-width="5"/><path d="M44 82L50 91M66 80L70 93M92 78L101 85M101 48L110 52M96 65L106 68M55 97L61 105" fill="none" stroke="#86603c" stroke-width="8"/><circle cx="129" cy="27" r="2" fill="#172839"/>' },
    bottle: { name: "水瓶", svg: '<path d="M66 25H95V54Q115 63 115 88V137Q82 150 47 137V88Q47 63 66 54Z" fill="#c4d8db"/><rect x="63" y="14" width="34" height="15" rx="3" fill="#6b8992"/><path d="M49 89H113V121H49Z" fill="#f2ead8"/><path d="M58 68Q67 62 66 38" fill="none" stroke="#fffdf7" stroke-width="5"/>' },
  };
  const pairs = [
    { id: "zebra-lamp", larger: "zebra", smaller: "lamp" },
    { id: "elephant-cup", larger: "elephant", smaller: "cup" },
    { id: "bus-chair", larger: "bus", smaller: "chair" },
    { id: "tree-key", larger: "tree", smaller: "key" },
    { id: "house-book", larger: "house", smaller: "book" },
    { id: "giraffe-bottle", larger: "giraffe", smaller: "bottle" },
  ];
  const sizeLabels = { congruent: "呈现大小一致", equal: "呈现大小相同", incongruent: "呈现大小不一致" };
  function sizeTrials(shuffle) {
    const result = pairs.flatMap((pair, index) => ["congruent", "equal", "incongruent"].map((condition, c) => ({ ...pair, condition, largerSide: (index + c) % 2 ? "right" : "left" })));
    result.push({ ...pairs[0], condition: "congruent", largerSide: "left" }, { ...pairs[1], condition: "incongruent", largerSide: "right" });
    return shuffle(result);
  }
  function objectDrawing(id, center, size) {
    return `<g data-object="${id}" transform="translate(${center - size / 2},${145 - size / 2}) scale(${size / 160})" stroke="#172839" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${objects[id].svg}</g>`;
  }
  function sizePicture(trial) {
    const largeSize = trial.condition === "equal" ? 140 : trial.condition === "congruent" ? 188 : 102;
    const smallSize = trial.condition === "equal" ? 140 : trial.condition === "congruent" ? 102 : 188;
    const left = trial.largerSide === "left" ? trial.larger : trial.smaller;
    const right = trial.largerSide === "right" ? trial.larger : trial.smaller;
    return `<svg data-size-comparison viewBox="0 0 580 290" role="img" aria-label="左右两个物体，请判断哪一个在现实中更大" style="display:block;width:min(100%,680px);margin:auto;background:#fffdf7"><rect x="8" y="8" width="564" height="274" rx="5" fill="none" stroke="#ccc4b8"/><path d="M290 20V270" stroke="#d7d1c7"/>${objectDrawing(left, 145, left === trial.larger ? largeSize : smallSize)}${objectDrawing(right, 435, right === trial.larger ? largeSize : smallSize)}</svg>`;
  }

  T.register({
    id: "real-size-comparison", name: "物体现实大小比较", chapter: "第七章", code: "7-1（大小比较）", category: "表象与空间认知", taskType: "现实大小判断", trialCount: 20,
    shortDescription: "忽略屏幕上的缩放，判断熟悉物体在现实中谁更大，体验视觉大小对表象比较的影响。",
    metrics: ["条件正确率", "正确反应时", "大小一致性效应"],
    instructions: ["只依据生活经验判断哪个物体在现实中更大，不判断屏幕图片大小或距离远近。", "每次左右各出现一个物体；较大物体在左侧按 F／左按钮，在右侧按 J／右按钮。", "材料包括斑马与台灯、大象与杯子、公共汽车与椅子、大树与钥匙、房屋与书本、长颈鹿与水瓶。", "共 20 次正式判断，图片大小可能与现实大小一致、相同或不一致。请又快又准。"],
    description: "# 学习目标\n比较物体在现实中的大小，观察图片呈现大小如何促进或干扰表象判断。此项按 Paivio（1975）大小比较任务实现，不包含距离判断。\n\n# 任务与条件\n20 次正式试次：图片呈现大小与现实大小一致 7 次、呈现大小相同 6 次、不一致 7 次。六组熟悉物体对均在三种条件出现，另增加两次平衡重复；现实较大物体左右位置各 10 次。每次注视 500 毫秒，随后并排呈现两张原创 SVG 物体图，最长反应窗口 5000 毫秒。F／左按钮表示现实较大的物体在左侧，J／右按钮表示在右侧。\n\n# 指标\n按条件计算正确率与正确试次平均 RT。不一致 RT−一致 RT 为总一致性差异；不一致 RT−相同 RT 为相对相同大小的干扰；相同 RT−一致 RT 为促进量。超时按错误保留但不进入正确 RT 平均，离开窗口的试次不进入条件汇总。\n\n# 解释与材料\n图片缩放不改变生活中物体的大小；所有结果来自实际选择，不强制呈现经典方向。现实大小采用典型成年动物和通常物件的明显差异，图形是未标准化的原创教学材料。每个试次 CSV 保留物体身份、现实较大物体、所在侧与呈现条件。\n\n# 来源与编号\n按《认知心理学》11.22 定稿的大小判断要求编写，参照 Paivio（1975）。原文两项实验均编号 7-1，此包用“7-1（大小比较）”区分，未擅自将另一项改编号为 7-2。",
    async run(c) {
      const trials = sizeTrials(c.shuffle);
      for (const [index, trial] of trials.entries()) {
        c.progress(index + 1, 20, "现实大小判断");
        await c.fixation(500);
        const response = await c.choose(`<p>哪一侧的物体在现实中更大？</p>${sizePicture(trial)}`, [{ value: "left", label: "F · 左侧", key: "f" }, { value: "right", label: "J · 右侧", key: "j" }], { timeout: 5000 });
        c.record({ phase: "formal", condition: trial.condition, pair: trial.id, larger_object: trial.larger, smaller_object: trial.smaller, larger_object_name: objects[trial.larger].name, smaller_object_name: objects[trial.smaller].name, larger_side: trial.largerSide, left_object: trial.largerSide === "left" ? trial.larger : trial.smaller, right_object: trial.largerSide === "right" ? trial.larger : trial.smaller, response: response.value, correct: response.value === trial.largerSide, rt: response.timedOut ? null : response.rt, timed_out: response.timedOut });
      }
      const conditions = ["congruent", "equal", "incongruent"];
      const subsets = conditions.map((condition) => c.rows.filter((row) => row.condition === condition));
      const means = subsets.map((rows) => correctRT(c, rows));
      return {
        metrics: [
          { label: "总体正确率", value: accuracy(c, c.rows), note: "按现实大小判分" },
          { label: "正确平均反应时", value: rtText(correctRT(c, c.rows)), note: "只统计有效且正确的反应" },
          { label: "大小一致性效应", value: diffText(means[2], means[0]), note: "不一致 RT − 一致 RT" },
          { label: "相同大小基线的干扰", value: diffText(means[2], means[1]), note: "不一致 RT − 相同 RT" },
          { label: "相同大小基线的促进", value: diffText(means[1], means[0]), note: "相同 RT − 一致 RT" },
        ],
        extraHtml: table(["图片条件", "有效试次", "正确率", "正确平均 RT"], subsets.map((rows, index) => [sizeLabels[conditions[index]], valid(rows).length, accuracy(c, rows), rtText(means[index])])),
        explanation: "一致性差异来自你对现实大小的判断。图片缩放可能促进或干扰反应，但短版重复材料、设备与熟悉程度也会影响差异；负值、零值和数据不足均如实呈现，不能把它作为个人表象能力测评。",
      };
    },
  });

  const angles = [0, 60, 120, 180, 240, 300];
  function shortestAngle(angle) { const a = ((angle % 360) + 360) % 360; return Math.min(a, 360 - a); }
  function rotationTrials(shuffle) {
    const trials = ["normal", "mirror"].flatMap((orientation) => angles.map((angle) => ({ orientation, angle })));
    for (const angle of [0, 60, 120, 180]) trials.push({ orientation: "normal", angle });
    for (const angle of [120, 180, 240, 300]) trials.push({ orientation: "mirror", angle });
    return shuffle(trials);
  }
  function letterR(orientation, angle) {
    return `<svg data-rotation-letter viewBox="0 0 280 280" role="img" aria-label="旋转的 R 字符，请判断正写或镜像" style="display:block;width:min(100%,290px);height:auto;margin:auto"><circle cx="140" cy="140" r="126" fill="#fffdf7" stroke="#ccc4b8"/><g transform="translate(140 140) rotate(${angle})"><g data-orientation="${orientation}" transform="scale(${orientation === "mirror" ? -1 : 1} 1)"><path d="M-44 72V-72H2C39-72 57-56 57-29C57-8 47 6 26 13L64 72H36L1 17H-19V72ZM-19-50V-5H0C22-5 32-13 32-28C32-44 22-50 0-50Z" fill="#172839" fill-rule="evenodd"/></g></g></svg>`;
  }
  function regressionSlope(rows) {
    const scored = valid(rows).filter((row) => row.correct === true && Number.isFinite(row.rt));
    if (new Set(scored.map((row) => row.angular_distance)).size < 2) return null;
    const x = scored.reduce((sum, row) => sum + row.angular_distance, 0) / scored.length;
    const y = scored.reduce((sum, row) => sum + row.rt, 0) / scored.length;
    const denominator = scored.reduce((sum, row) => sum + (row.angular_distance - x) ** 2, 0);
    return denominator ? scored.reduce((sum, row) => sum + (row.angular_distance - x) * (row.rt - y), 0) / denominator : null;
  }
  function rotationCurve(c, rows) {
    const distances = [0, 60, 120, 180];
    const series = ["normal", "mirror"].map((orientation) => ({ orientation, label: orientation === "normal" ? "正写 R" : "镜像 R", color: orientation === "normal" ? "#1f5067" : "#c74b36", points: distances.map((distance) => ({ x: distance, y: correctRT(c, rows.filter((row) => row.orientation === orientation && row.angular_distance === distance)) })) }));
    const values = series.flatMap((line) => line.points.map((point) => point.y)).filter((value) => value !== null);
    if (!values.length) return '<p>没有有效且正确的反应，暂不能绘制反应时曲线。</p>';
    const maxY = Math.max(200, Math.ceil(Math.max(...values) / 200) * 200);
    const x = (value) => 68 + value / 180 * 445;
    const y = (value) => 272 - value / maxY * 220;
    const grid = Array.from({ length: 5 }, (_, index) => { const value = index * maxY / 4; return `<path d="M68 ${y(value)}H513" stroke="#d8d0c4"/><text x="60" y="${y(value) + 4}" text-anchor="end" font-size="12">${Math.round(value)}</text>`; }).join("");
    const lines = series.map((line) => line.points.map((point, index) => `${point.y === null ? "" : `<circle cx="${x(point.x)}" cy="${y(point.y)}" r="4" fill="${line.color}"><title>${line.label}，${point.x}°：${Math.round(point.y)} ms</title></circle>`}${index > 0 && point.y !== null && line.points[index - 1].y !== null ? `<path d="M${x(line.points[index - 1].x)} ${y(line.points[index - 1].y)}L${x(point.x)} ${y(point.y)}" fill="none" stroke="${line.color}" stroke-width="2.5"/>` : ""}`).join("")).join("");
    return `<h3>本次正确反应时与最短旋转角度</h3><svg data-rotation-curve viewBox="0 0 570 345" role="img" aria-label="实际正确反应时曲线，分别显示正写 R 与镜像 R" style="display:block;width:100%;background:#fffdf7;color:#172839"><g fill="#172839" font-family="sans-serif">${grid}<path d="M68 52V272H513" stroke="#172839" fill="none"/>${distances.map((distance) => `<text x="${x(distance)}" y="293" text-anchor="middle" font-size="13">${distance}°</text>`).join("")}<text x="290" y="326" text-anchor="middle" font-size="14">距直立位置的最短角度</text><text x="22" y="165" text-anchor="middle" transform="rotate(-90 22 165)" font-size="14">正确 RT（毫秒）</text><text x="330" y="24" font-size="13" fill="#1f5067">● 正写 R</text><text x="425" y="24" font-size="13" fill="#c74b36">● 镜像 R</text>${lines}</g></svg><p class="result-note">只连接相邻且有真实正确反应的角度；缺失条件不会补成零。240°按120°、300°按60°折叠。</p>`;
  }

  T.register({
    id: "mental-rotation", name: "R 字符心理旋转", chapter: "第七章", code: "7-1（R旋转）", category: "表象与空间认知", taskType: "正写与镜像判断", trialCount: 20,
    shortDescription: "判断不同角度的 R 是正写还是镜像，观察旋转角度与判断时间的关系。",
    metrics: ["正写与镜像正确率", "角度—反应时曲线", "角度与 RT 描述性斜率"],
    instructions: ["不论朝向如何，判断字形是否是通常的正写 R，还是左右翻转的镜像 R。", "F／正写按钮＝正写；J／镜像按钮＝镜像。请不要把倒置或旋转本身当作镜像。", "先做 2 次练习，随后 20 次正式判断。字形方向含 0°、60°、120°、180°、240°、300°。", "最长作答时间 5 秒；可以使用电脑按键或手机按钮。"],
    description: "# 学习目标\n体验心理旋转：把不同方向的字形与熟悉的直立表象比较，再判断正写或镜像。\n\n# 任务设计\n按定稿的 R 字符图示独立实现，未声称复用尚未提供的课堂原程序。正写与镜像各 10 个正式试次，共 20 次；六个角度为 0°、60°、120°、180°、240°、300°，每角度 3–4 次。先进行 2 次直立字形练习并反馈。每次注视 500 毫秒后呈现原创 R 路径，最长作答 5000 毫秒。镜像先做左右翻转，再在同一中心旋转，避免把单纯旋转当成镜像。\n\n# 操作\n按 F 或点击“正写”，按 J 或点击“镜像”。所有角度使用同一 R 轮廓与固定大小，图中不显示答案和角度。\n\n# 指标\n记录每个字形的原始角度、距直立的最短角度、正写／镜像、反应、正确性和 RT；超时保留为空 RT。展示正写与镜像正确率、按原始角度分组的正确 RT 表，以及按最短角度 0–180°折叠的实际 RT 曲线。描述性斜率为正确试次 RT 对最短角度的一元回归系数，单位 ms/度；至少有两个有正确反应的角度才计算。离开窗口试次不纳入汇总。\n\n# 结果理解\n小样本曲线可能不随角度单调增加，斜率可以为零或负数。曲线只用真实正确反应，不填入教材示例图的数值，也不作显著性推断。按键熟悉程度与屏幕会影响反应。\n\n# 来源与编号\n参照 Cooper 与 Shepard（1973）的字形心理旋转方法及本教材 R 正写／镜像图示编写。原定稿两项均写作 7-1，本包以“7-1（R旋转）”区分，待编辑统一编号。",
    async run(c) {
      const choices = [{ value: "normal", label: "F · 正写", key: "f" }, { value: "mirror", label: "J · 镜像", key: "j" }];
      for (const orientation of ["normal", "mirror"]) {
        c.progress(orientation === "normal" ? 1 : 2, 2, "字形练习");
        const answer = await c.choose(`<p>判断字形是正写还是镜像。</p>${letterR(orientation, 0)}`, choices, { timeout: 5000 });
        await c.note(`<h2>${answer.value === orientation ? "判断正确" : "请再看字形"}</h2>${letterR(orientation, 0)}<p>这是${orientation === "normal" ? "通常的正写 R" : "左右翻转的镜像 R"}。旋转字形不会改变它原本的正写／镜像属性。</p>`, orientation === "mirror" ? "开始正式实验" : "下一次练习");
      }
      const trials = rotationTrials(c.shuffle);
      for (const [index, trial] of trials.entries()) {
        c.progress(index + 1, 20, "R 字形判断");
        await c.fixation(500);
        const response = await c.choose(letterR(trial.orientation, trial.angle), choices, { timeout: 5000 });
        c.record({ phase: "formal", condition: trial.orientation, orientation: trial.orientation, angle: trial.angle, angular_distance: shortestAngle(trial.angle), response: response.value, correct: response.value === trial.orientation, rt: response.timedOut ? null : response.rt, timed_out: response.timedOut });
      }
      const rows = valid(c.rows);
      const slope = regressionSlope(rows);
      return {
        metrics: [
          { label: "总体正确率", value: accuracy(c, rows), note: "正写与镜像共 20 个正式试次" },
          { label: "正确平均反应时", value: rtText(correctRT(c, rows)), note: "仅统计有效且正确的反应" },
          { label: "正写正确率", value: accuracy(c, rows.filter((row) => row.orientation === "normal")), note: "正写 R 的有效试次" },
          { label: "镜像正确率", value: accuracy(c, rows.filter((row) => row.orientation === "mirror")), note: "左右翻转 R 的有效试次" },
          { label: "角度与 RT 的描述性斜率", value: slope === null ? "数据不足" : `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} ms/度`, note: "RT 对最短旋转角度的回归，不是显著性检验" },
          { label: "镜像与正写 RT 差", value: diffText(correctRT(c, rows.filter((row) => row.orientation === "mirror")), correctRT(c, rows.filter((row) => row.orientation === "normal"))), note: "镜像正确 RT − 正写正确 RT" },
        ],
        extraHtml: rotationCurve(c, rows) + table(["原始角度", "正写正确率", "正写正确 RT", "镜像正确率", "镜像正确 RT"], angles.map((angle) => { const normal = rows.filter((row) => row.angle === angle && row.orientation === "normal"), mirror = rows.filter((row) => row.angle === angle && row.orientation === "mirror"); return [`${angle}°`, accuracy(c, normal), rtText(correctRT(c, normal)), accuracy(c, mirror), rtText(correctRT(c, mirror))]; })),
        explanation: "正写与镜像是字形属性，旋转改变的是朝向。图表使用这一次实际作答；正确 RT 随角度的变化可用于讨论表象转换，但 20 个短版试次不能稳定估计个人的心理旋转速度。",
      };
    },
  });

  T.imageryChecks = Object.freeze({ objects, pairs, sizeTrials, sizePicture, rotationTrials, letterR, shortestAngle, regressionSlope, rotationCurve });
})(window.Textbook);
