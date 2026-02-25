/**
 * supabase.js — Supabase client for storing exports.
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in environment.
 *
 * Table: ghl_exports
 *   id            uuid (PK, auto)
 *   module_id     text
 *   data          jsonb
 *   record_count  int4
 *   exported_at   timestamptz
 *   location_id   text
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('   ✅  Supabase connected');
} else {
    console.log('   ⚠  Supabase not configured — exports will use local filesystem only');
}

/**
 * Save export data to Supabase (insert new row every time).
 */
export async function saveToSupabase(moduleId, data, locationId, description) {
    if (!supabase) return null;
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    const { data: result, error } = await supabase
        .from('ghl_exports')
        .insert({
            module_id: moduleId,
            location_id: locationId,
            description: description || moduleId,
            data: data,
            record_count: count,
            exported_at: new Date().toISOString(),
        })
        .select();
    if (error) {
        console.error(`   ❌  Supabase save failed for ${moduleId}:`, error.message);
        throw error;
    }
    return result;
}

/**
 * Read export data from Supabase.
 */
export async function readFromSupabase(moduleId, locationId) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('ghl_exports')
        .select('*')
        .eq('module_id', moduleId)
        .eq('location_id', locationId)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error(`   ❌  Supabase read failed for ${moduleId}:`, error.message);
    }
    return data || null;
}

/**
 * Get manifest (all exports) from Supabase.
 */
export async function getManifestFromSupabase(locationId) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('ghl_exports')
        .select('module_id, record_count, exported_at')
        .eq('location_id', locationId);
    if (error) return null;
    const manifest = {};
    (data || []).forEach(row => {
        manifest[row.module_id] = { count: row.record_count, exportedAt: row.exported_at };
    });
    return manifest;
}

export { supabase };
