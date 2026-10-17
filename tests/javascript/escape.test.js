import { describe, it, expect } from 'vitest';
import { escape_html, is_safe_url } from '@js/escape.js';

describe('escape_html', () => {
    it('escapes the html special characters', () => {
        expect(escape_html(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    });

    it('turns null and undefined into an empty string', () => {
        expect(escape_html(null)).toBe('');
        expect(escape_html(undefined)).toBe('');
    });

    it('converts other values to strings', () => {
        expect(escape_html(42)).toBe('42');
    });
});

describe('is_safe_url', () => {
    it('allows http, https and relative urls', () => {
        expect(is_safe_url('https://example.com')).toBe(true);
        expect(is_safe_url('HTTP://example.com')).toBe(true);
        expect(is_safe_url('/log?path=a')).toBe(true);
        expect(is_safe_url('log.html#s1')).toBe(true);
        expect(is_safe_url('//example.com')).toBe(true);
    });

    it('rejects other schemes', () => {
        expect(is_safe_url('javascript:alert(1)')).toBe(false);
        expect(is_safe_url(' JavaScript:alert(1)')).toBe(false);
        expect(is_safe_url('java\tscript:alert(1)')).toBe(false);
        expect(is_safe_url('data:text/html,<b>x</b>')).toBe(false);
        expect(is_safe_url('vbscript:x')).toBe(false);
    });

    it('rejects empty values', () => {
        expect(is_safe_url('')).toBe(false);
        expect(is_safe_url(null)).toBe(false);
    });
});
