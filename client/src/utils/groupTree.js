// 그룹 목록(parent_id 포함)을 트리 순서로 평탄화한다 — 각 그룹 바로 뒤에 그 하위
// 그룹들이 오도록 재배열하고, 들여쓰기에 쓸 depth를 붙인다. <select><option>은 진짜
// 중첩을 지원하지 않으므로, 웹에서 흔히 쓰는 "들여쓰기 텍스트" 방식으로 계층을 표현한다.
export function flattenGroupTree(groups) {
  const byParent = new Map();
  for (const g of groups) {
    const key = g.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(g);
  }
  const out = [];
  const visit = (parentId, depth, visited) => {
    for (const g of byParent.get(parentId) || []) {
      if (visited.has(g.id)) continue; // 순환 방어(정상 동작에서는 발생하지 않음)
      visited.add(g.id);
      out.push({ ...g, depth });
      visit(g.id, depth + 1, visited);
    }
  };
  visit(null, 0, new Set());
  return out;
}

// 특정 그룹을 선택했을 때, 그 그룹 자신 + 모든 하위 그룹(손자 포함)의 id를 모은다.
// "업체" 그룹을 선택하면 그 아래 모든 "캠페인" 그룹의 키워드까지 함께 보여주기 위함.
export function collectGroupAndDescendantIds(groups, groupId) {
  const id = Number(groupId);
  const byParent = new Map();
  for (const g of groups) {
    const key = g.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(g);
  }
  const ids = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const child of byParent.get(current) || []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      stack.push(child.id);
    }
  }
  return ids;
}
