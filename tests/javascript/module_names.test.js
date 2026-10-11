import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The generator (dependencies.py) strips imports and exports and concatenates every module of
// js/ into one script. Top-level names therefore share one scope: a second `function x` silently
// replaces the first one and a second `const x` stops the whole page.
const jsRoot = fileURLToPath(new URL('../../robotframework_dashboard/js', import.meta.url));
const declaration = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([\w$]+)|(?:const|let|var|class)\s+([\w$]+))/gm;

function dashboard_modules(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === 'admin_page' ? [] : dashboard_modules(path);
        return name.endsWith('.js') ? [path] : [];
    });
}

describe('dashboard modules merged into one script', () => {
    it('declare every top-level name only once', () => {
        const owners = new Map();
        for (const file of dashboard_modules(jsRoot)) {
            for (const match of readFileSync(file, 'utf-8').matchAll(declaration)) {
                const name = match[1] || match[2];
                owners.set(name, [...(owners.get(name) || []), relative(jsRoot, file)]);
            }
        }
        const duplicates = [...owners].filter(([, files]) => files.length > 1);
        expect(duplicates).toEqual([]);
    });
});
