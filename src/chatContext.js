// Pure helpers that build a compact live snapshot of the ResQ-Net simulation state
// for the server-side Gemini assistant (/api/chat).

const round1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

export function buildSimulationContext({
  page = 'cascade',
  user = null,
  data = null,
  scenario = null,
  result = null,
  shown = null,
  fixed = null,
  showFixed = false,
  respResult = null,
  responses = [],
  showResp = false,
  alerts = [],
  t = 0,
  horizon = 72,
  mode = 'idle',
  params = {},
  linkTally = null,
  crit = null,
  nowMap = null,
  hospitalsNow = null,
  selectedNode = null,
} = {}) {
  const info = data?.meta?.info || null;
  const hospTotal = info?.counts?.hospital || 0;
  const activeResult = shown || result || null;
  const ri = activeResult && hospTotal && horizon
    ? Math.max(0, Math.round(1000 * (1 - activeResult.impact_hospital_hours / (hospTotal * horizon))) / 10)
    : null;

  const agencyCounts = {};
  let criticalAlerts = 0;
  for (const a of alerts || []) {
    agencyCounts[a.agency] = (agencyCounts[a.agency] || 0) + 1;
    if (a.severity === 'critical') criticalAlerts += 1;
  }

  const cauveryStations = {};
  if (nowMap && info?.stages) {
    for (const [id, name] of [['cauvery_tk_halli', 'TK Halli'], ['cauvery_harohalli', 'Harohalli'], ['cauvery_tataguni', 'Tataguni']]) {
      const feederState = nowMap.get(`feeder_${id}`)?.state || 'UP';
      const downStages = [];
      const backupStages = [];
      for (const s of info.stages) {
        const st = nowMap.get(`${id}_${s.toLowerCase()}`)?.state || 'UP';
        if (st === 'DOWN') downStages.push(s);
        else if (st === 'BACKUP') backupStages.push(s);
      }
      cauveryStations[name] = { feederState, downStages, backupStages };
    }
  }

  return {
    page,
    userRole: user?.role || 'guest',
    userAgency: user?.agency || null,
    mode,
    status: activeResult ? 'running' : mode === 'weak' && crit ? 'weak_links' : 'idle',
    cityBaseline: info ? {
      hospitals: info.counts.hospital,
      substations: (info.counts.substation || 0) + (info.counts.substation_tx || 0),
      waterFacilities: info.counts.reservoir,
      telecomSites: info.counts.telecom,
      totalLinks: linkTally?.total ?? null,
      weakLinksCount: linkTally?.weak ?? null,
      weakLinksPct: linkTally?.weakPct ?? null,
      isSampleMap: !!info.is_sample,
    } : null,
    assumptions: {
      hospitalDieselBackupHours: params.hospital_diesel_h ?? null,
      hospitalWaterStorageHours: params.hospital_water_h ?? null,
      reservoirStorageHours: params.reservoir_storage_h ?? null,
      telecomBatteryHours: params.telecom_battery_h ?? null,
    },
    activeScenario: scenario ? {
      label: scenario.label,
      note: scenario.note || null,
      currentHour: round1(t),
      horizonHours: horizon,
      viewingWithFixes: !!showFixed,
      viewingWithResponses: !!showResp,
    } : null,
    metrics: activeResult ? {
      resilienceIndex: ri,
      hospitalsDownAtCurrentHour: hospitalsNow?.down ?? 0,
      hospitalsOnBackupAtCurrentHour: hospitalsNow?.backup ?? 0,
      totalHospitalsEventuallyDown: activeResult.hospitals_down ?? 0,
      firstHospitalDownHour: round1(activeResult.first_hospital_down_h),
      impactHospitalHoursLost: Math.round(activeResult.impact_hospital_hours || 0),
      affectedHospitalsCount: activeResult.hospitals?.length || 0,
    } : null,
    topAffectedHospitals: (activeResult?.hospitals || []).slice(0, 8).map((h) => ({
      name: h.name,
      stateNow: nowMap?.get?.(h.id)?.state || 'UP',
      warningAtH: round1(h.warning_at_h),
      downAtH: round1(h.down_at_h),
      downReason: h.down_reason || null,
      hoursDown: round1(h.hours_down),
    })),
    cauverySupplyChain: Object.keys(cauveryStations).length ? cauveryStations : null,
    alertsSummary: alerts?.length ? {
      total: alerts.length,
      criticalCount: criticalAlerts,
      byAgency: agencyCounts,
      topCriticalAlerts: alerts.filter((a) => a.severity === 'critical').slice(0, 6).map((a) => ({
        agency: a.agency,
        title: a.title,
        hitAtH: round1(a.hitAt),
        failAtH: round1(a.failAt),
        hospitalsDependent: a.hosp || 0,
        action: a.action?.label || null,
      })),
    } : null,
    fixesSummary: fixed?.rec ? {
      baselineHospitalHoursLost: fixed.rec.baseline?.impact_hospital_hours,
      withFixesHospitalHoursLost: fixed.rec.plan_result?.impact_hospital_hours,
      reductionPct: fixed.rec.plan_result?.reduction_pct,
      recommendedSteps: (fixed.rec.plan || []).map((s) => ({
        action: s.label,
        facility: s.name,
        provider: s.provider_name || null,
        hoursSaved: Math.round((s.impact_before || 0) - (s.impact_after || 0)),
      })),
    } : null,
    operatorResponses: responses?.length ? {
      actionsTaken: responses.length,
      resultingHospitalsDown: respResult?.hospitals_down ?? null,
      resultingHospitalHoursLost: respResult ? Math.round(respResult.impact_hospital_hours) : null,
    } : null,
    weakestLinksTop5: mode === 'weak' && Array.isArray(crit)
      ? crit.slice(0, 5).map((c) => ({
          name: c.name,
          hospitalsDown: c.hospitals_down,
          hospitalHoursLost: Math.round(c.impact_hospital_hours || 0),
        }))
      : null,
    selectedFacility: selectedNode ? {
      name: selectedNode.name,
      kind: selectedNode.kind,
      stateNow: nowMap?.get?.(selectedNode.id)?.state || 'UP',
      reasonNow: nowMap?.get?.(selectedNode.id)?.reason || null,
    } : null,
  };
}

export function buildSuggestedQuestions(simContext) {
  if (!simContext || simContext.page !== 'cascade') {
    return [
      'What can ResQ-Net simulate for Bengaluru?',
      'How do citizen alerts connect to infrastructure cascades?',
      'Which authorities handle power vs water failures?',
    ];
  }
  if (simContext.mode === 'weak' && simContext.weakestLinksTop5?.length) {
    return [
      'Why is the top weakest link so critical?',
      'How do backup reserves affect weak links?',
      'Which scenario should I run next?',
    ];
  }
  if (simContext.activeScenario) {
    return [
      'Which hospitals fail first and why?',
      'How is the Resilience Index calculated right now?',
      'What actions save the most hospital-hours?',
    ];
  }
  return [
    'What happens when I run Heavy rain?',
    'Why are 22% of city infrastructure links marked weak?',
    'How do the assumption sliders change simulation outcomes?',
  ];
}

export function formatChatPayload({ message, history = [], context = null }) {
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  const cleanHistory = Array.isArray(history)
    ? history
        .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
    : [];
  return {
    message: cleanMessage,
    history: cleanHistory,
    context: context || null,
  };
}
