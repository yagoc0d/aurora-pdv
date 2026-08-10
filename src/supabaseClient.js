import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ejlslkgvvbxobskfazzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z3nDmrjSnLE0Wca_lVFWLQ_z6HNEmJn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
