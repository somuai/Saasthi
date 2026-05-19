/** MCP-specific rule helpers used by the risk engine */

export function latestAncHb(mcpData) {
  const v = mcpData?.latestAncVisit;
  if (v?.hemoglobinGm != null) return Number(v.hemoglobinGm);
  if (mcpData?.latestHb != null) return Number(mcpData.latestHb);
  return null;
}

export function ancVisitCountFromMcp(mcpData) {
  if (!mcpData) return 0;
  if (typeof mcpData.ancVisitCount === "number") return mcpData.ancVisitCount;
  let n = 0;
  for (let i = 1; i <= 5; i += 1) {
    const j = mcpData[`anc_visit_${i}_json`] || mcpData[`ancVisit${i}Json`];
    if (j && String(j).length > 2) n += 1;
  }
  return n;
}

export function isAncUnderUtilized(mcpData, pogWeeks = null) {
  const visits = ancVisitCountFromMcp(mcpData);
  const pog = pogWeeks ?? mcpData?.pogWeeks ?? 0;
  if (pog >= 28 && visits < 3) return true;
  if (pog >= 14 && visits < 2) return true;
  if (pog >= 8 && visits < 1) return true;
  return false;
}

export function hasSevereAnemiaFromMcp(mcpData) {
  const hb = latestAncHb(mcpData);
  return hb != null && hb > 0 && hb < 8;
}

export function hasModerateAnemiaFromMcp(mcpData) {
  const hb = latestAncHb(mcpData);
  return hb != null && hb >= 8 && hb < 11;
}
