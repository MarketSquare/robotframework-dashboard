import { runs } from '../variables/data.js';

// Merge two profile objects according to the "largest horizon" rules:
//   runTags / projectVersions : union of checked entries
//   tagMode                   : most permissive wins (OR > AND > NOT)
//   fromDate / fromTime       : take the earlier value  (widest start)
//   toDate   / toTime         : take the later  value  (widest end)
//   amount                   : take the larger value
//   runs / metadata          : keep if identical, otherwise "All"
function merge_two_profiles(profileA, profileB) {
    const result = {};

    if (profileA.runs !== undefined && profileB.runs !== undefined) {
        result.runs = profileA.runs === profileB.runs ? profileA.runs : "All";
    } else if (profileA.runs !== undefined) {
        result.runs = profileA.runs;
    } else if (profileB.runs !== undefined) {
        result.runs = profileB.runs;
    }

    if (profileA.runTags !== undefined || profileB.runTags !== undefined) {
        const tagsA = profileA.runTags || [];
        const tagsB = profileB.runTags || [];
        const merged = {};
        tagsA.forEach(t => { merged[t.id] = t.checked; });
        tagsB.forEach(t => { merged[t.id] = merged[t.id] || t.checked; });
        result.runTags = Object.entries(merged).map(([id, checked]) => ({ id, checked }));
    }

    if (profileA.tagMode !== undefined || profileB.tagMode !== undefined ||
        profileA.useOrTags !== undefined || profileB.useOrTags !== undefined) {
        const permissiveness = { "OR": 2, "AND": 1, "NOT": 0 };
        // Convert legacy useOrTags boolean to tagMode string if needed
        const modeA = profileA.tagMode ?? (profileA.useOrTags ? "OR" : "AND");
        const modeB = profileB.tagMode ?? (profileB.useOrTags ? "OR" : "AND");
        result.tagMode = (permissiveness[modeA] ?? 1) >= (permissiveness[modeB] ?? 1) ? modeA : modeB;
    }

    if (profileA.projectVersions !== undefined || profileB.projectVersions !== undefined) {
        const versA = profileA.projectVersions || [];
        const versB = profileB.projectVersions || [];
        const merged = {};
        versA.forEach(v => { merged[v.value] = v.checked; });
        versB.forEach(v => { merged[v.value] = merged[v.value] || v.checked; });
        result.projectVersions = Object.entries(merged).map(([value, checked]) => ({ value, checked }));
    }

    if (profileA.fromDate !== undefined && profileB.fromDate !== undefined) {
        const dtA = `${profileA.fromDate}T${profileA.fromTime || "00:00"}`;
        const dtB = `${profileB.fromDate}T${profileB.fromTime || "00:00"}`;
        const earlier = dtA <= dtB ? profileA : profileB;
        result.fromDate = earlier.fromDate;
        if (earlier.fromTime !== undefined) result.fromTime = earlier.fromTime;
    } else if (profileA.fromDate !== undefined) {
        result.fromDate = profileA.fromDate;
        if (profileA.fromTime !== undefined) result.fromTime = profileA.fromTime;
    } else if (profileB.fromDate !== undefined) {
        result.fromDate = profileB.fromDate;
        if (profileB.fromTime !== undefined) result.fromTime = profileB.fromTime;
    }

    if (profileA.toDate !== undefined && profileB.toDate !== undefined) {
        const dtA = `${profileA.toDate}T${profileA.toTime || "23:59"}`;
        const dtB = `${profileB.toDate}T${profileB.toTime || "23:59"}`;
        const later = dtA >= dtB ? profileA : profileB;
        result.toDate = later.toDate;
        if (later.toTime !== undefined) result.toTime = later.toTime;
    } else if (profileA.toDate !== undefined) {
        result.toDate = profileA.toDate;
        if (profileA.toTime !== undefined) result.toTime = profileA.toTime;
    } else if (profileB.toDate !== undefined) {
        result.toDate = profileB.toDate;
        if (profileB.toTime !== undefined) result.toTime = profileB.toTime;
    }

    if (profileA.metadata !== undefined && profileB.metadata !== undefined) {
        result.metadata = profileA.metadata === profileB.metadata ? profileA.metadata : "All";
    } else if (profileA.metadata !== undefined) {
        result.metadata = profileA.metadata;
    } else if (profileB.metadata !== undefined) {
        result.metadata = profileB.metadata;
    }

    if (profileA.amount !== undefined && profileB.amount !== undefined) {
        result.amount = String(Math.max(Number(profileA.amount), Number(profileB.amount)));
    } else if (profileA.amount !== undefined) {
        result.amount = profileA.amount;
    } else if (profileB.amount !== undefined) {
        result.amount = profileB.amount;
    }

    if (profileA.suitePath !== undefined || profileB.suitePath !== undefined) {
        const a = profileA.suitePath ?? "All";
        const b = profileB.suitePath ?? "All";
        result.suitePath = a === b ? a : "All";
    }

    if (profileA.customFilters !== undefined || profileB.customFilters !== undefined) {
        const cfA = profileA.customFilters || {};
        const cfB = profileB.customFilters || {};
        const allDims = new Set([...Object.keys(cfA), ...Object.keys(cfB)]);
        const mergedCF = {};
        for (const dim of allDims) {
            const vA = cfA[dim] || [];
            const vB = cfB[dim] || [];
            const merged = {};
            vA.forEach(v => { merged[v.value] = v.checked; });
            vB.forEach(v => { merged[v.value] = merged[v.value] || v.checked; });
            mergedCF[dim] = Object.entries(merged).map(([value, checked]) => ({ value, checked }));
        }
        result.customFilters = mergedCF;
    }

    if (profileA.customFilterModes !== undefined || profileB.customFilterModes !== undefined) {
        const modesA = profileA.customFilterModes || {};
        const modesB = profileB.customFilterModes || {};
        const allDims = new Set([...Object.keys(modesA), ...Object.keys(modesB)]);
        const permissiveness = { "OR": 2, "AND": 1, "NOT": 0 };
        const mergedModes = {};
        for (const dim of allDims) {
            const mA = modesA[dim] ?? "OR";
            const mB = modesB[dim] ?? "OR";
            mergedModes[dim] = (permissiveness[mA] ?? 2) >= (permissiveness[mB] ?? 2) ? mA : mB;
        }
        result.customFilterModes = mergedModes;
    }

    return result;
}

export { merge_two_profiles };
