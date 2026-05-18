/** MCP-specific rule helpers used by risk engine */
export function latestAncHb(mcpData) {
  const v = mcpData?.latestAncVisit;
  if (v?.hemoglobinGm != null) return Number(v.hemoglobinGm);
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
