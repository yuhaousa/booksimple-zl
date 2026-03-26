const experiments = [
  {
    title: "量子双缝干涉",
    category: "physics",
    level: "大学·入门",
    duration: "30 分钟",
    summary: "虚拟光场演示叠加与干涉，支持实时调整缝宽与光源波长。",
    equipment: ["可调缝宽模块", "单色光源", "感光屏"],
    outcomes: "干涉条纹宽度与波长、缝宽的定量关系。",
  },
  {
    title: "酸碱指示剂渐变",
    category: "chemistry",
    level: "初中·演示",
    duration: "15 分钟",
    summary: "通过食醋、苏打与紫甘蓝指示液演示 pH 渐变，提供颜色对照表。",
    equipment: ["紫甘蓝滤液", "滴管", "pH 颜色标尺"],
    outcomes: "pH 对应颜色的可视化梯度；安全、易获取的替代方案。",
  },
  {
    title: "微重力环境下的摆动",
    category: "earth",
    level: "高中·探究",
    duration: "25 分钟",
    summary: "模拟不同重力场（地球、月球、火星）下的单摆周期差异。",
    equipment: ["重力因子模拟器", "摆锤模型"],
    outcomes: "重力对周期的影响；适合跨学科讨论星球环境。",
  },
  {
    title: "酵母呼吸速率",
    category: "biology",
    level: "高中·验证",
    duration: "35 分钟",
    summary: "对比温度与糖浓度对酵母产气速率的影响，自动绘制折线图。",
    equipment: ["恒温水浴", "气体收集管", "葡萄糖溶液"],
    outcomes: "最佳温度区间及底物浓度；可导出实验曲线。",
  },
  {
    title: "可再生能源微电网",
    category: "project",
    level: "跨学科·项目",
    duration: "60 分钟",
    summary: "集成光伏、风能与储能策略，优化负载匹配，输出供能报告。",
    equipment: ["光伏面板模型", "风机模型", "能量管理算法"],
    outcomes: "不同天气与负载的策略优劣；适合工程类课题。",
  },
  {
    title: "水循环与污染溯源",
    category: "earth",
    level: "小学·演示",
    duration: "20 分钟",
    summary: "通过可视化水循环与污染物扩散，演示过滤与吸附方案。",
    equipment: ["沙土模型", "染色指示剂", "活性炭滤层"],
    outcomes: "污染路径与治理手段；适合环保主题课。",
  },
];

const grid = document.getElementById("experimentGrid");
const filterButtons = document.querySelectorAll(".filter-btn");
const startLabButton = document.getElementById("startLab");
const noteInput = document.getElementById("noteInput");
const submitNote = document.getElementById("submitNote");
const timeline = document.getElementById("timeline");

const renderExperiments = (filter = "all") => {
  grid.innerHTML = "";
  const filtered =
    filter === "all" ? experiments : experiments.filter((item) => item.category === filter);

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong>${item.title}</strong>
        <span class="tag">${item.level}</span>
      </div>
      <p class="small" style="margin-top:8px;">${item.summary}</p>
      <div class="tag-row">
        ${item.equipment.map((tool) => `<span class="tag">${tool}</span>`).join("")}
      </div>
      <div class="small">⏱️ ${item.duration} · 预期收获：${item.outcomes}</div>
    `;
    grid.appendChild(card);
  });
};

renderExperiments();

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderExperiments(btn.dataset.filter);
  });
});

startLabButton?.addEventListener("click", () => {
  document.getElementById("controls")?.scrollIntoView({ behavior: "smooth" });
});

// 欧姆定律交互
const voltage = document.getElementById("voltage");
const resistance = document.getElementById("resistance");
const voltageValue = document.getElementById("voltageValue");
const resistanceValue = document.getElementById("resistanceValue");
const currentEl = document.getElementById("current");
const powerEl = document.getElementById("power");
const ohmProgress = document.getElementById("ohmProgress");
const ohmSafety = document.getElementById("ohmSafety");

const updateOhm = () => {
  const v = Number(voltage.value);
  const r = Number(resistance.value);
  const current = v / r;
  const power = v * current;

  voltageValue.textContent = v.toFixed(0);
  resistanceValue.textContent = r.toFixed(0);
  currentEl.textContent = `${current.toFixed(2)} A`;
  powerEl.textContent = `${power.toFixed(2)} W`;

  const loadPercent = Math.min(100, (power / 8) * 100);
  ohmProgress.style.width = `${Math.max(8, loadPercent)}%`;

  if (power > 8) {
    ohmSafety.textContent = "功率偏高，建议提高电阻或降低电压。";
    ohmSafety.style.color = "#ffc857";
  } else {
    ohmSafety.textContent = "负载处于安全区间。";
    ohmSafety.style.color = "var(--muted)";
  }
};

voltage?.addEventListener("input", updateOhm);
resistance?.addEventListener("input", updateOhm);
updateOhm();

// 单摆周期
const lengthInput = document.getElementById("length");
const lengthValue = document.getElementById("lengthValue");
const periodEl = document.getElementById("period");

const updatePendulum = () => {
  const L = Number(lengthInput.value);
  const g = 9.81;
  const period = 2 * Math.PI * Math.sqrt(L / g);
  lengthValue.textContent = L.toFixed(1);
  periodEl.textContent = `${period.toFixed(2)} s`;
};

lengthInput?.addEventListener("input", updatePendulum);
updatePendulum();

// 酸碱滴定
const baseVolume = document.getElementById("baseVolume");
const baseValue = document.getElementById("baseValue");
const phValue = document.getElementById("phValue");
const titrationProgress = document.getElementById("titrationProgress");
const titrationNote = document.getElementById("titrationNote");

const updateTitration = () => {
  const acidM = 0.1; // mol/L
  const acidVolume = 0.05; // L (50 mL)
  const baseM = 0.1;
  const baseVolMl = Number(baseVolume.value);
  const baseVol = baseVolMl / 1000; // L

  baseValue.textContent = baseVolMl.toFixed(0);
  const acidMoles = acidM * acidVolume;
  const baseMoles = baseM * baseVol;
  const totalVolume = acidVolume + baseVol;
  let ph;

  if (baseMoles < acidMoles) {
    const hPlus = (acidMoles - baseMoles) / totalVolume;
    ph = -Math.log10(hPlus);
    titrationNote.textContent = "强酸未完全中和，继续滴加碱液。";
  } else if (baseMoles === acidMoles) {
    ph = 7;
    titrationNote.textContent = "到达当量点，保持轻微搅拌。";
  } else {
    const ohMinus = (baseMoles - acidMoles) / totalVolume;
    ph = 14 + Math.log10(ohMinus);
    titrationNote.textContent = "已过量滴定，记录 pH 变化并适当回滴。";
  }

  const clampedPh = Math.min(14, Math.max(0, ph));
  phValue.textContent = clampedPh.toFixed(2);

  const progress = Math.min(100, (baseVolMl / 50) * 100);
  titrationProgress.style.width = `${Math.max(6, progress)}%`;
};

baseVolume?.addEventListener("input", updateTitration);
updateTitration();

// 记录与时间线
submitNote?.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (!text) return;

  const item = document.createElement("div");
  item.className = "timeline-item";
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  item.innerHTML = `
    <div>
      <div>📝 实验记录</div>
      <div class="small">${text}</div>
      <div class="small">${time} · 已同步云端</div>
    </div>
    <span class="pill">新记录</span>
  `;

  timeline.prepend(item);
  noteInput.value = "";
});
