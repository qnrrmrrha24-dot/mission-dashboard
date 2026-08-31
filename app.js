/* ============================================================
   MISSION 부동산 CRM 대시보드 — 데이터 fetch & 렌더링
   Supabase REST API를 anon key로 직접 호출합니다 (읽기 전용 공개 정책).
   ============================================================ */

const SUPABASE_URL = "https://yvzebtdrtokprbughpxt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2emVidGRydG9rcHJidWdocHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTI3MDYsImV4cCI6MjEwMzQ2ODcwNn0.g8yzgfGNV392clnRy1__RDnx0bUFO_HxLg_NeByEiFM";

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${path} (${res.status})`);
  return res.json();
}

const fmtInt = (n) => Math.round(n).toLocaleString("ko-KR");
const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString("ko-KR");

const CSS = getComputedStyle(document.documentElement);
const cv = (name) => CSS.getPropertyValue(name).trim();

Chart.defaults.font.family = "'Noto Sans KR', sans-serif";
Chart.defaults.color = cv("--ink-2");
Chart.defaults.borderColor = cv("--line");

/* value-label plugin: draws a text label above each bar */
const barValueLabels = (formatter) => ({
  id: "barValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      meta.data.forEach((bar, i) => {
        const value = ds.data[i];
        if (value == null) return;
        ctx.save();
        ctx.fillStyle = cv("--ink-2");
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(formatter(value, i), bar.x, bar.y - 8);
        ctx.restore();
      });
    });
  },
});

async function main() {
  try {
    const [channelFunnel, monthlyAds, unitsMaster, customers, contracts] =
      await Promise.all([
        sb("v_channel_funnel?select=*"),
        sb("v_monthly_ads?select=*&order=month.asc"),
        sb("v_units_master?select=unit_type,unit_status,status_consistency"),
        sb("customers?select=customer_id,lead_source"),
        sb("contracts?select=customer_id,status"),
      ]);

    renderKPIs({ channelFunnel, monthlyAds, unitsMaster, contracts });
    renderChannelChart(channelFunnel);
    renderConsistencyChart(unitsMaster);
    renderLeadsChart(monthlyAds);
    renderCplChart(monthlyAds);
    const unitTypeStats = renderUnitTypeChart(unitsMaster);
    const leadSourceStats = renderLeadSourceChart(customers, contracts);

    renderInsights({
      channelFunnel,
      monthlyAds,
      unitsMaster,
      unitTypeStats,
      leadSourceStats,
    });

    document.getElementById("last-updated").textContent =
      "실시간 연동 · " +
      new Date().toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  } catch (err) {
    console.error(err);
    document.getElementById("last-updated").textContent = "데이터 로드 실패 — 새로고침해 주세요";
  }
}

function renderKPIs({ channelFunnel, monthlyAds, unitsMaster, contracts }) {
  const totalConsults = channelFunnel.reduce((s, c) => s + c.consult_count, 0);
  const totalWish = channelFunnel.reduce((s, c) => s + c.wish_count, 0);
  const totalSpend = monthlyAds.reduce((s, m) => s + Number(m.spend_10k_krw), 0);
  const totalLeads = monthlyAds.reduce((s, m) => s + Number(m.leads), 0);
  const completedContracts = contracts.filter((c) => c.status === "완료").length;

  document.getElementById("kpi-units").textContent = fmtInt(unitsMaster.length);
  document.getElementById("kpi-consults").textContent = fmtInt(totalConsults);
  document.getElementById("kpi-contracts").textContent = fmtInt(completedContracts);
  document.getElementById("kpi-conv").textContent = fmt1((totalWish / totalConsults) * 100);
  document.getElementById("kpi-adspend").textContent = fmtInt(totalSpend);
  document.getElementById("kpi-cpl").textContent = fmt1(totalSpend / totalLeads);
}

/* fixed categorical order — never cycled */
const CHANNEL_ORDER = ["전화", "방문", "SNS", "온라인"];
const CHANNEL_COLOR = {
  전화: cv("--c-phone"),
  방문: cv("--c-visit"),
  SNS: cv("--c-sns"),
  온라인: cv("--c-online"),
};

function renderChannelChart(channelFunnel) {
  const rows = [...channelFunnel].sort(
    (a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel)
  );
  new Chart(document.getElementById("chart-channel"), {
    type: "bar",
    data: {
      labels: rows.map((r) => r.channel),
      datasets: [
        {
          label: "상담 건수",
          data: rows.map((r) => r.consult_count),
          backgroundColor: rows.map((r) => CHANNEL_COLOR[r.channel]),
          borderRadius: 6,
          maxBarThickness: 72,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => `계약희망 전환율 ${rows[ctx.dataIndex].wish_rate_pct}%`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: cv("--line") }, ticks: { padding: 6 } },
        x: { grid: { display: false } },
      },
      layout: { padding: { top: 24 } },
    },
    plugins: [
      barValueLabels((v, i) => `${v.toLocaleString("ko-KR")}건 · 전환 ${rows[i].wish_rate_pct}%`),
    ],
  });
}

function renderConsistencyChart(unitsMaster) {
  let good = 0,
    bad = 0,
    warn = 0;
  unitsMaster.forEach((u) => {
    if (u.status_consistency === "일치") good++;
    else if (u.status_consistency.startsWith("확인필요")) warn++;
    else bad++;
  });
  new Chart(document.getElementById("chart-consistency"), {
    type: "doughnut",
    data: {
      labels: [`일치 (${good})`, `불일치 (${bad})`, `확인필요·중복 (${warn})`],
      datasets: [
        {
          data: [good, bad, warn],
          backgroundColor: [cv("--s-good"), cv("--s-bad"), cv("--s-warn")],
          borderColor: cv("--surface"),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, padding: 14, font: { size: 11 } } },
      },
    },
  });
  return { good, bad, warn };
}

function monthLabel(m) {
  const [y, mo] = m.split("-");
  return `${y.slice(2)}.${mo}`;
}

function renderLeadsChart(monthlyAds) {
  const max = Math.max(...monthlyAds.map((m) => m.leads));
  new Chart(document.getElementById("chart-leads"), {
    type: "bar",
    data: {
      labels: monthlyAds.map((m) => monthLabel(m.month)),
      datasets: [
        {
          label: "리드 수",
          data: monthlyAds.map((m) => m.leads),
          backgroundColor: monthlyAds.map((m) =>
            m.leads === max ? cv("--s-good") : cv("--seq-3")
          ),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: cv("--line") } },
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
      },
    },
  });
}

function renderCplChart(monthlyAds) {
  const cpls = monthlyAds.map((m) => Number(m.cost_per_lead_10k_krw));
  const maxCpl = Math.max(...cpls);
  const minCpl = Math.min(...cpls);
  new Chart(document.getElementById("chart-cpl"), {
    type: "line",
    data: {
      labels: monthlyAds.map((m) => monthLabel(m.month)),
      datasets: [
        {
          label: "CPL (만원)",
          data: cpls,
          borderColor: cv("--primary"),
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: cpls.map((c) => (c === maxCpl || c === minCpl ? 5 : 2)),
          pointBackgroundColor: cpls.map((c) =>
            c === maxCpl ? cv("--s-bad") : c === minCpl ? cv("--s-good") : cv("--primary")
          ),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: cv("--line") } },
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
      },
    },
  });
}

function renderUnitTypeChart(unitsMaster) {
  const byType = {};
  unitsMaster.forEach((u) => {
    byType[u.unit_type] ??= { total: 0, sold: 0 };
    byType[u.unit_type].total++;
    if (u.unit_status === "계약완료") byType[u.unit_type].sold++;
  });
  const stats = Object.entries(byType)
    .map(([type, v]) => ({ type, ...v, rate: (v.sold / v.total) * 100 }))
    .sort((a, b) => b.rate - a.rate);

  new Chart(document.getElementById("chart-unittype"), {
    type: "bar",
    data: {
      labels: stats.map((s) => s.type),
      datasets: [
        {
          label: "판매율(%)",
          data: stats.map((s) => s.rate),
          backgroundColor: stats.map((s) =>
            s.rate === Math.max(...stats.map((x) => x.rate)) ? cv("--s-good") : cv("--primary")
          ),
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${stats[ctx.dataIndex].sold}/${stats[ctx.dataIndex].total}세대 판매`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: cv("--line") } },
        x: { grid: { display: false } },
      },
      layout: { padding: { top: 20 } },
    },
    plugins: [barValueLabels((v) => `${v.toFixed(0)}%`)],
  });
  return stats;
}

function renderLeadSourceChart(customers, contracts) {
  const completedIds = new Set(
    contracts.filter((c) => c.status === "완료").map((c) => c.customer_id)
  );
  const bySource = {};
  customers.forEach((c) => {
    bySource[c.lead_source] ??= { total: 0, converted: 0 };
    bySource[c.lead_source].total++;
    if (completedIds.has(c.customer_id)) bySource[c.lead_source].converted++;
  });
  const stats = Object.entries(bySource)
    .map(([source, v]) => ({ source, ...v, rate: (v.converted / v.total) * 100 }))
    .sort((a, b) => b.rate - a.rate);

  new Chart(document.getElementById("chart-leadsource"), {
    type: "bar",
    data: {
      labels: stats.map((s) => s.source),
      datasets: [
        {
          label: "전환율(%)",
          data: stats.map((s) => s.rate),
          backgroundColor: stats.map((s, i) =>
            i === 0 ? cv("--s-good") : i === stats.length - 1 ? cv("--s-bad") : cv("--primary")
          ),
          borderRadius: 6,
          maxBarThickness: 34,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${stats[ctx.dataIndex].converted}/${stats[ctx.dataIndex].total}건 전환`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, max: 45, grid: { color: cv("--line") } },
        y: { grid: { display: false } },
      },
    },
  });
  return stats;
}

function insightCard({ index, severity, title, finding, evidence, action, full }) {
  return `
    <article class="insight-card severity-${severity}${full ? " full" : ""}">
      <span class="insight-index">INSIGHT ${index}</span>
      <h3 class="insight-title">${title}</h3>
      <div class="insight-block">
        <span class="insight-block-label">발견</span>
        <p>${finding}</p>
      </div>
      <div class="insight-block">
        <span class="insight-block-label">근거 데이터</span>
        <p class="evidence-figure">${evidence}</p>
      </div>
      <div class="insight-block action">
        <span class="insight-block-label">제안 액션</span>
        <p>${action}</p>
      </div>
    </article>`;
}

function renderInsights({ channelFunnel, monthlyAds, unitsMaster, unitTypeStats, leadSourceStats }) {
  const cards = [];

  /* 1. 매물 상태 정합성 */
  const total = unitsMaster.length;
  let good = 0,
    dup = 0;
  unitsMaster.forEach((u) => {
    if (u.status_consistency === "일치") good++;
    if (u.status_consistency.startsWith("확인필요")) dup++;
  });
  const mismatch = total - good;
  cards.push(
    insightCard({
      index: "①",
      severity: "bad",
      title: "매물상태 필드의 절반 이상이 계약 이력과 어긋납니다",
      finding: `전체 매물 ${total}세대 중 <b>${mismatch}세대(${fmt1(
        (mismatch / total) * 100
      )}%)</b>에서 units.status와 실제 계약 이력이 일치하지 않습니다. 이 중 ${dup}세대는 완료 계약이 2건 이상 중복 등록되어 있습니다.`,
      evidence: `일치 ${good}건 · 불일치/확인필요 ${mismatch}건 (중복 ${dup}건 포함) — v_units_master.status_consistency 집계`,
      action: `계약이 '완료' 상태로 바뀔 때 매물 status를 자동 갱신하는 트리거 도입, 중복계약 ${dup}건은 우선 수기 검수 대상으로 분류`,
      full: true,
    })
  );

  /* 2. 채널 퍼널 불균형 */
  const totalConsult = channelFunnel.reduce((s, c) => s + c.consult_count, 0);
  const phone = channelFunnel.find((c) => c.channel === "전화");
  const sns = channelFunnel.find((c) => c.channel === "SNS");
  cards.push(
    insightCard({
      index: "②",
      severity: "info",
      title: "상담 물량이 가장 많은 채널이 오히려 전환율은 가장 낮습니다",
      finding: `'전화' 상담은 전체의 <b>${fmt1(
        (phone.consult_count / totalConsult) * 100
      )}%</b>를 차지하지만 전환율은 ${phone.wish_rate_pct}%로 4개 채널 중 가장 낮습니다. 반대로 'SNS'는 비중이 ${fmt1(
        (sns.consult_count / totalConsult) * 100
      )}%에 불과한데도 전환율은 ${sns.wish_rate_pct}%로 가장 높습니다.`,
      evidence: `전화 ${phone.consult_count}건 / 전환 ${phone.wish_rate_pct}% &nbsp;·&nbsp; SNS ${sns.consult_count}건 / 전환 ${sns.wish_rate_pct}%`,
      action: `SNS 채널에 상담 인력·예산을 시범 확대하고 결과를 4주 단위로 추적, 전화 상담은 스크립트/큐레이션 개선 A/B 테스트 진행`,
    })
  );

  /* 3. 광고 효율 이상치 */
  const sorted = [...monthlyAds].sort(
    (a, b) => Number(a.cost_per_lead_10k_krw) - Number(b.cost_per_lead_10k_krw)
  );
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  cards.push(
    insightCard({
      index: "③",
      severity: "warn",
      title: "특정 월의 광고 효율이 유독 저조합니다",
      finding: `${monthLabel(worst.month).replace(
        ".",
        "년 "
      )}월은 광고비 ${fmtInt(worst.spend_10k_krw)}만원을 집행하고도 리드 ${fmtInt(
        worst.leads
      )}건에 그쳐 CPL이 ${worst.cost_per_lead_10k_krw}만원으로 24개월 중 가장 비효율적이었습니다. 비슷한 규모의 예산을 쓴 ${monthLabel(
        best.month
      ).replace(".", "년 ")}월은 CPL ${best.cost_per_lead_10k_krw}만원으로 가장 효율적이었습니다.`,
      evidence: `${worst.month} 지출 ${fmtInt(worst.spend_10k_krw)}만원 / 리드 ${fmtInt(
        worst.leads
      )}건 (CPL ${worst.cost_per_lead_10k_krw}) &nbsp;·&nbsp; ${best.month} 지출 ${fmtInt(
        best.spend_10k_krw
      )}만원 / 리드 ${fmtInt(best.leads)}건 (CPL ${best.cost_per_lead_10k_krw})`,
      action: `${worst.month} 캠페인의 소재·타겟팅을 재검토하고, ${best.month}에 사용된 채널 믹스를 벤치마킹해 저효율 월에 적용`,
    })
  );

  /* 4. 평형별 판매율 */
  const bestType = unitTypeStats[0];
  const worstType = unitTypeStats[unitTypeStats.length - 1];
  cards.push(
    insightCard({
      index: "④",
      severity: "bad",
      title: "특정 평형의 재고가 유독 소진되지 않고 있습니다",
      finding: `'${worstType.type}' 타입은 전체 ${worstType.total}세대 중 ${
        worstType.sold
      }세대만 판매되어 판매율 <b>${fmt1(worstType.rate)}%</b>로 전체 타입 중 가장 저조합니다. 가장 양호한 '${
        bestType.type
      }' 타입(${fmt1(bestType.rate)}%)과 큰 격차가 있습니다.`,
      evidence: `${worstType.type} ${worstType.sold}/${worstType.total}세대 (${fmt1(
        worstType.rate
      )}%) &nbsp;·&nbsp; ${bestType.type} ${bestType.sold}/${bestType.total}세대 (${fmt1(
        bestType.rate
      )}%)`,
      action: `${worstType.type} 재고에 대한 가격 조정 또는 프로모션(입주 지원, 대출 연계 등) 검토, 판매 정체 원인(구조/향/층)에 대한 현장 조사`,
    })
  );

  /* 5. 리드소스 전환율 */
  const bestSrc = leadSourceStats[0];
  const worstSrc = leadSourceStats[leadSourceStats.length - 1];
  cards.push(
    insightCard({
      index: "⑤",
      severity: "good",
      title: "유입 경로에 따라 전환율 격차가 뚜렷합니다",
      finding: `리드소스 '${bestSrc.source}'의 전환율이 <b>${fmt1(
        bestSrc.rate
      )}%</b>로 가장 높고, '${worstSrc.source}'는 ${fmt1(
        worstSrc.rate
      )}%로 가장 낮습니다. 오프라인 '방문' 리드가 온라인 채널 대비 전환이 저조한 경향이 있습니다.`,
      evidence: `${bestSrc.source} ${bestSrc.converted}/${bestSrc.total}건 (${fmt1(
        bestSrc.rate
      )}%) &nbsp;·&nbsp; ${worstSrc.source} ${worstSrc.converted}/${worstSrc.total}건 (${fmt1(
        worstSrc.rate
      )}%)`,
      action: `${worstSrc.source} 리드의 초기 응대 프로세스와 SLA를 점검하고, ${bestSrc.source} 채널은 예산 비중을 유지·확대`,
    })
  );

  document.getElementById("insight-grid").innerHTML = cards.join("\n");
}

main();
