import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ajxmbaufzsyryzuadwyc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6p67zQHlCqASmmJ05zH8Hw_fMMitd-A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
